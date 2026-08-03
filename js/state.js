'use strict';

/**
 * NINJA SCHEDULE
 * state.js
 *
 * 予定データの状態管理を担当します。
 *
 * 現在の役割:
 * - GASから予定一覧を取得
 * - localStorageへキャッシュ
 * - GAS取得失敗時はキャッシュを使用
 * - 予定の追加・更新・削除は現段階ではlocalStorage
 */

(function () {
  const DEFAULT_STORAGE_KEY =
    'ninja-schedule-coach-schedules-v1';

  const VALID_SCHEDULE_TYPES = Object.freeze([
    'practice',
    'game',
    'trip',
    'off',
  ]);

  const VALID_CATEGORIES = Object.freeze([
    'boys-all',
    'girls-all',
    'boys-u13',
    'girls-u13',
    'boys-u14',
    'girls-u14',
    'boys-u15',
    'girls-u15',
  ]);

  const VALID_STATUSES = Object.freeze([
    'published',
    'draft',
  ]);

  const State = {
    schedules: [],
    initialized: false,
    loading: false,
    lastError: null,
    lastSyncedAt: '',
    ready: Promise.resolve(),

    /**
     * 状態管理を初期化します。
     *
     * 最初にキャッシュを表示し、その後GASから最新データを取得します。
     *
     * @returns {Promise<Object[]>}
     */
    init() {
      if (this.loading) {
        return this.ready;
      }

      this.schedules = this.loadCachedSchedules();
      this.sortSchedules();
      this.initialized = true;

      this.ready = this.refreshFromApi({
        silent: true,
      });

      return this.ready;
    },

    /**
     * GASから予定を再取得します。
     *
     * @param {{silent?: boolean}} [options]
     * @returns {Promise<Object[]>}
     */
    async refreshFromApi(options = {}) {
      if (this.loading) {
        return this.getSchedules();
      }

      if (
        !window.NinjaApi ||
        typeof window.NinjaApi.getSchedules !== 'function'
      ) {
        const error = new Error(
          'API通信機能が読み込まれていません。'
        );

        this.lastError = error;

        if (!options.silent) {
          this.notifyError(error.message);
        }

        return this.getSchedules();
      }

      this.loading = true;
      this.lastError = null;

      this.dispatchStateEvent(
        'ninja:schedules-loading',
        {
          loading: true,
        }
      );

      try {
        const apiData =
          await window.NinjaApi.getSchedules();

        const remoteSchedules =
          this.extractSchedulesFromApiData(apiData);

        const normalizedSchedules = [];

        remoteSchedules.forEach((record) => {
          try {
            const schedule =
              this.normalizeSchedule(record);

            this.validateSchedule(schedule);

            normalizedSchedules.push(schedule);
          } catch (error) {
            console.warn(
              'APIから取得した不正な予定を除外しました。',
              {
                error,
                record,
              }
            );
          }
        });

        this.schedules =
          this.removeDuplicateSchedules(
            normalizedSchedules
          );

        this.sortSchedules();
        this.persistSchedules();

        this.lastSyncedAt =
          new Date().toISOString();

        this.renderApplication();

        this.dispatchStateEvent(
          'ninja:schedules-updated',
          {
            source: 'api',
            schedules:
              this.getSchedules(),
            syncedAt:
              this.lastSyncedAt,
          }
        );

        return this.getSchedules();
      } catch (error) {
        this.lastError = error;

        console.error(
          'GASから予定を取得できませんでした。端末内の保存データを表示します。',
          error
        );

        if (!options.silent) {
          this.notifyError(
            error instanceof Error
              ? error.message
              : '予定を取得できませんでした。'
          );
        }

        this.renderApplication();

        this.dispatchStateEvent(
          'ninja:schedules-load-error',
          {
            error,
            schedules:
              this.getSchedules(),
          }
        );

        return this.getSchedules();
      } finally {
        this.loading = false;

        this.dispatchStateEvent(
          'ninja:schedules-loading',
          {
            loading: false,
          }
        );
      }
    },

    /**
     * 予定一覧を取得します。
     *
     * @returns {Object[]}
     */
    getSchedules() {
      return this.clone(
        this.schedules
      );
    },

    /**
     * 公開予定だけを取得します。
     *
     * @returns {Object[]}
     */
    getPublishedSchedules() {
      return this.clone(
        this.schedules.filter(
          (schedule) =>
            schedule.status ===
            'published'
        )
      );
    },

    /**
     * IDから予定を1件取得します。
     *
     * @param {string} scheduleId
     * @returns {Object|null}
     */
    getScheduleById(scheduleId) {
      const normalizedId =
        this.normalizeText(scheduleId);

      if (!normalizedId) {
        return null;
      }

      const schedule =
        this.schedules.find(
          (item) =>
            item.id === normalizedId
        );

      return schedule
        ? this.clone(schedule)
        : null;
    },

    /**
     * 指定日の予定を取得します。
     *
     * @param {string} date
     * @returns {Object[]}
     */
    getSchedulesByDate(date) {
      const normalizedDate =
        this.normalizeText(date);

      if (
        !this.isValidDate(
          normalizedDate
        )
      ) {
        return [];
      }

      return this.clone(
        this.schedules.filter(
          (schedule) =>
            schedule.date ===
            normalizedDate
        )
      );
    },

    /**
     * 指定期間の予定を取得します。
     *
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Object[]}
     */
    getSchedulesByDateRange(
      startDate,
      endDate
    ) {
      const normalizedStart =
        this.normalizeText(startDate);

      const normalizedEnd =
        this.normalizeText(endDate);

      if (
        !this.isValidDate(
          normalizedStart
        ) ||
        !this.isValidDate(
          normalizedEnd
        ) ||
        normalizedStart >
          normalizedEnd
      ) {
        return [];
      }

      return this.clone(
        this.schedules.filter(
          (schedule) =>
            schedule.date >=
              normalizedStart &&
            schedule.date <=
              normalizedEnd
        )
      );
    },

    /**
     * 指定月の予定を取得します。
     *
     * @param {number} year
     * @param {number} month 1〜12
     * @returns {Object[]}
     */
    getSchedulesByMonth(
      year,
      month
    ) {
      const numericYear =
        Number(year);

      const numericMonth =
        Number(month);

      if (
        !Number.isInteger(
          numericYear
        ) ||
        !Number.isInteger(
          numericMonth
        ) ||
        numericMonth < 1 ||
        numericMonth > 12
      ) {
        return [];
      }

      const startDate =
        `${numericYear}-${String(
          numericMonth
        ).padStart(2, '0')}-01`;

      const lastDay =
        new Date(
          numericYear,
          numericMonth,
          0
        ).getDate();

      const endDate =
        `${numericYear}-${String(
          numericMonth
        ).padStart(2, '0')}-${String(
          lastDay
        ).padStart(2, '0')}`;

      return this.getSchedulesByDateRange(
        startDate,
        endDate
      );
    },

    /**
     * カテゴリーで予定を取得します。
     *
     * @param {string} category
     * @returns {Object[]}
     */
    getSchedulesByCategory(
      category
    ) {
      const normalizedCategory =
        this.normalizeText(category);

      if (
        normalizedCategory ===
        'all'
      ) {
        return this.getSchedules();
      }

      if (
        !VALID_CATEGORIES.includes(
          normalizedCategory
        )
      ) {
        return [];
      }

      return this.clone(
        this.schedules.filter(
          (schedule) =>
            schedule.categories.includes(
              normalizedCategory
            )
        )
      );
    },

    /**
     * 新規予定を端末内へ保存します。
     *
     * GAS保存への切り替えは次のSTEPで行います。
     *
     * @param {Object} scheduleData
     * @returns {Object}
     */
    createSchedule(scheduleData) {
      const now =
        new Date().toISOString();

      const schedule =
        this.normalizeSchedule({
          ...scheduleData,
          id:
            this.normalizeText(
              scheduleData?.id
            ) || this.createId(),
          createdAt:
            this.normalizeText(
              scheduleData?.createdAt
            ) || now,
          updatedAt: now,
        });

      this.validateSchedule(schedule);

      const exists =
        this.schedules.some(
          (item) =>
            item.id === schedule.id
        );

      if (exists) {
        throw new Error(
          '同じIDの予定がすでに存在します。'
        );
      }

      this.schedules.push(schedule);
      this.sortSchedules();
      this.persistSchedules();

      return this.clone(schedule);
    },

    /**
     * 予定を端末内で更新します。
     *
     * @param {string} scheduleId
     * @param {Object} scheduleData
     * @returns {Object}
     */
    updateSchedule(
      scheduleId,
      scheduleData
    ) {
      const normalizedId =
        this.normalizeText(scheduleId);

      if (!normalizedId) {
        throw new Error(
          '更新する予定IDがありません。'
        );
      }

      const index =
        this.schedules.findIndex(
          (schedule) =>
            schedule.id ===
            normalizedId
        );

      if (index === -1) {
        throw new Error(
          '更新対象の予定が見つかりません。'
        );
      }

      const existing =
        this.schedules[index];

      const updated =
        this.normalizeSchedule({
          ...existing,
          ...scheduleData,
          id: existing.id,
          createdAt:
            existing.createdAt,
          updatedAt:
            new Date().toISOString(),
        });

      this.validateSchedule(updated);

      this.schedules[index] =
        updated;

      this.sortSchedules();
      this.persistSchedules();

      return this.clone(updated);
    },

    /**
     * 新規または更新保存します。
     *
     * @param {Object} scheduleData
     * @returns {{
     *   action: 'created'|'updated',
     *   data: Object
     * }}
     */
    saveSchedule(scheduleData) {
      const scheduleId =
        this.normalizeText(
          scheduleData?.id
        );

      const exists =
        scheduleId
          ? this.schedules.some(
              (schedule) =>
                schedule.id ===
                scheduleId
            )
          : false;

      if (exists) {
        return {
          action: 'updated',
          data:
            this.updateSchedule(
              scheduleId,
              scheduleData
            ),
        };
      }

      return {
        action: 'created',
        data:
          this.createSchedule(
            scheduleData
          ),
      };
    },

    /**
     * 予定を端末内から削除します。
     *
     * @param {string} scheduleId
     * @returns {boolean}
     */
    deleteSchedule(scheduleId) {
      const normalizedId =
        this.normalizeText(scheduleId);

      if (!normalizedId) {
        return false;
      }

      const index =
        this.schedules.findIndex(
          (schedule) =>
            schedule.id ===
            normalizedId
        );

      if (index === -1) {
        return false;
      }

      this.schedules.splice(
        index,
        1
      );

      this.persistSchedules();

      return true;
    },

    /**
     * 予定を端末内で複写します。
     *
     * @param {string} scheduleId
     * @param {string} newDate
     * @returns {Object}
     */
    copySchedule(
      scheduleId,
      newDate
    ) {
      const source =
        this.getScheduleById(
          scheduleId
        );

      if (!source) {
        throw new Error(
          '複写元の予定が見つかりません。'
        );
      }

      const normalizedDate =
        this.normalizeText(newDate);

      if (
        !this.isValidDate(
          normalizedDate
        )
      ) {
        throw new Error(
          '複写先の日付が正しくありません。'
        );
      }

      return this.createSchedule({
        ...source,
        id: '',
        date: normalizedDate,
        createdAt: '',
        updatedAt: '',
      });
    },

    /**
     * APIレスポンスから予定配列を抽出します。
     *
     * GAS側のレスポンス形式が次のどれでも対応します。
     * - data: [...]
     * - data: {schedules: [...]}
     * - data: {records: [...]}
     * - data: {items: [...]}
     *
     * @param {unknown} apiData
     * @returns {Object[]}
     */
    extractSchedulesFromApiData(
      apiData
    ) {
      if (Array.isArray(apiData)) {
        return apiData;
      }

      if (
        !apiData ||
        typeof apiData !== 'object'
      ) {
        return [];
      }

      const candidates = [
        apiData.schedules,
        apiData.records,
        apiData.items,
        apiData.rows,
        apiData.list,
        apiData.data,
      ];

      const found =
        candidates.find(
          (candidate) =>
            Array.isArray(candidate)
        );

      if (found) {
        return found;
      }

      return [];
    },

    /**
     * API・localStorageの予定をアプリ形式へ変換します。
     *
     * @param {Object} record
     * @returns {Object}
     */
    normalizeSchedule(record) {
      const source =
        record &&
        typeof record === 'object'
          ? record
          : {};

      const allDay =
        this.toBoolean(
          source.allDay ??
          source.all_day ??
          source.isAllDay
        );

      return {
        id:
          this.normalizeText(
            source.id ??
            source.scheduleId ??
            source.schedule_id ??
            source.ID
          ) || this.createId(),

        scheduleType:
          this.normalizeScheduleType(
            source.scheduleType ??
            source.schedule_type ??
            source.type
          ),

        categories:
          this.normalizeCategories(
            source.categories ??
            source.category ??
            source.targetCategories ??
            source.target_categories
          ),

        title:
          this.normalizeText(
            source.title ??
            source.scheduleTitle ??
            source.name
          ),

        date:
          this.normalizeDateValue(
            source.date ??
            source.scheduleDate ??
            source.schedule_date ??
            source.startDate
          ),

        allDay,

        startTime:
          allDay
            ? ''
            : this.normalizeTimeValue(
                source.startTime ??
                source.start_time
              ),

        endTime:
          allDay
            ? ''
            : this.normalizeTimeValue(
                source.endTime ??
                source.end_time
              ),

        meetingTime:
          allDay
            ? ''
            : this.normalizeTimeValue(
                source.meetingTime ??
                source.meeting_time
              ),

        location:
          this.normalizeText(
            source.location ??
            source.venue ??
            source.place
          ),

        mapUrl:
          this.normalizeText(
            source.mapUrl ??
            source.map_url ??
            source.googleMapUrl
          ),

        attendanceDeadline:
          this.normalizeDateTimeValue(
            source.attendanceDeadline ??
            source.attendance_deadline ??
            source.deadline
          ),

        belongings:
          this.normalizeText(
            source.belongings ??
            source.items ??
            source.bringItems
          ),

        description:
          this.normalizeText(
            source.description ??
            source.details ??
            source.note
          ),

        coachNote:
          this.normalizeText(
            source.coachNote ??
            source.coach_note ??
            source.internalNote
          ),

        status:
          this.normalizeStatus(
            source.status ??
            source.publishStatus ??
            source.publish_status
          ),

        createdAt:
          this.normalizeText(
            source.createdAt ??
            source.created_at
          ),

        updatedAt:
          this.normalizeText(
            source.updatedAt ??
            source.updated_at
          ),
      };
    },

    /**
     * 予定データを検証します。
     *
     * @param {Object} schedule
     */
    validateSchedule(schedule) {
      if (!schedule.id) {
        throw new Error(
          '予定IDがありません。'
        );
      }

      if (
        !VALID_SCHEDULE_TYPES.includes(
          schedule.scheduleType
        )
      ) {
        throw new Error(
          '予定種別が正しくありません。'
        );
      }

      if (
        schedule.categories.length ===
        0
      ) {
        throw new Error(
          '対象カテゴリーがありません。'
        );
      }

      if (!schedule.title) {
        throw new Error(
          'タイトルがありません。'
        );
      }

      if (
        !this.isValidDate(
          schedule.date
        )
      ) {
        throw new Error(
          '予定日が正しくありません。'
        );
      }

      if (
        !VALID_STATUSES.includes(
          schedule.status
        )
      ) {
        throw new Error(
          '公開状態が正しくありません。'
        );
      }
    },

    /**
     * 重複する予定IDを除外します。
     *
     * @param {Object[]} schedules
     * @returns {Object[]}
     */
    removeDuplicateSchedules(
      schedules
    ) {
      const map = new Map();

      schedules.forEach(
        (schedule) => {
          map.set(
            schedule.id,
            schedule
          );
        }
      );

      return Array.from(
        map.values()
      );
    },

    /**
     * 予定を日付・時間順に並べ替えます。
     */
    sortSchedules() {
      this.schedules.sort(
        (first, second) => {
          const firstKey = [
            first.date,
            first.allDay
              ? '00:00'
              : first.startTime ||
                '23:59',
            first.title,
          ].join('|');

          const secondKey = [
            second.date,
            second.allDay
              ? '00:00'
              : second.startTime ||
                '23:59',
            second.title,
          ].join('|');

          return firstKey.localeCompare(
            secondKey,
            'ja'
          );
        }
      );
    },

    /**
     * キャッシュを読み込みます。
     *
     * @returns {Object[]}
     */
    loadCachedSchedules() {
      try {
        const stored =
          window.localStorage.getItem(
            this.getStorageKey()
          );

        if (!stored) {
          return [];
        }

        const parsed =
          JSON.parse(stored);

        if (!Array.isArray(parsed)) {
          return [];
        }

        const schedules = [];

        parsed.forEach((record) => {
          try {
            const schedule =
              this.normalizeSchedule(
                record
              );

            this.validateSchedule(
              schedule
            );

            schedules.push(schedule);
          } catch (error) {
            console.warn(
              '不正なキャッシュ予定を除外しました。',
              error
            );
          }
        });

        return schedules;
      } catch (error) {
        console.error(
          '予定キャッシュの読み込みに失敗しました。',
          error
        );

        return [];
      }
    },

    /**
     * キャッシュへ保存します。
     */
    persistSchedules() {
      try {
        window.localStorage.setItem(
          this.getStorageKey(),
          JSON.stringify(
            this.schedules
          )
        );
      } catch (error) {
        console.error(
          '予定キャッシュの保存に失敗しました。',
          error
        );

        throw new Error(
          '予定を端末へ保存できませんでした。'
        );
      }
    },

    /**
     * localStorageキーを取得します。
     *
     * @returns {string}
     */
    getStorageKey() {
      return (
        window.NinjaConfig
          ?.STORAGE
          ?.SCHEDULES_KEY ||
        DEFAULT_STORAGE_KEY
      );
    },

    /**
     * アプリ画面を再描画します。
     */
    renderApplication() {
      window.requestAnimationFrame(
        () => {
          if (
            window.NinjaApp &&
            typeof window.NinjaApp
              .renderApplication ===
              'function'
          ) {
            window.NinjaApp
              .renderApplication();

            return;
          }

          if (
            window.NinjaCalendar &&
            typeof window.NinjaCalendar
              .render === 'function'
          ) {
            window.NinjaCalendar
              .render();
          }
        }
      );
    },

    /**
     * エラーメッセージを画面へ表示します。
     *
     * @param {string} message
     */
    notifyError(message) {
      if (
        window.NinjaApp &&
        typeof window.NinjaApp
          .showApplicationStatus ===
          'function'
      ) {
        window.NinjaApp
          .showApplicationStatus(
            'error',
            message
          );
      }
    },

    /**
     * 状態変更イベントを送信します。
     *
     * @param {string} eventName
     * @param {Object} detail
     */
    dispatchStateEvent(
      eventName,
      detail
    ) {
      window.dispatchEvent(
        new CustomEvent(
          eventName,
          {
            detail,
          }
        )
      );
    },

    /**
     * カテゴリーを正規化します。
     *
     * @param {unknown} value
     * @returns {string[]}
     */
    normalizeCategories(value) {
      let values = [];

      if (Array.isArray(value)) {
        values = value;
      } else if (
        typeof value === 'string'
      ) {
        const trimmed =
          value.trim();

        if (
          trimmed.startsWith('[')
        ) {
          try {
            const parsed =
              JSON.parse(trimmed);

            values =
              Array.isArray(parsed)
                ? parsed
                : [];
          } catch (error) {
            values =
              trimmed.split(
                /[,、|]/
              );
          }
        } else {
          values =
            trimmed.split(
              /[,、|]/
            );
        }
      }

      const normalized = [
        ...new Set(
          values
            .map((item) =>
              this.normalizeCategory(
                item
              )
            )
            .filter((item) =>
              VALID_CATEGORIES.includes(
                item
              )
            )
        ),
      ];

      return normalized.length > 0
        ? normalized
        : ['boys-all'];
    },

    /**
     * カテゴリー1件を正規化します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeCategory(value) {
      const text =
        this.normalizeText(value)
          .toLowerCase();

      const map = {
        '男子全体': 'boys-all',
        '女子全体': 'girls-all',
        '男子u13': 'boys-u13',
        '男子u14': 'boys-u14',
        '男子u15': 'boys-u15',
        '女子u13': 'girls-u13',
        '女子u14': 'girls-u14',
        '女子u15': 'girls-u15',
      };

      return map[
        this.normalizeText(value)
      ] || text;
    },

    /**
     * 予定種別を正規化します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeScheduleType(value) {
      const original =
        this.normalizeText(value);

      const lower =
        original.toLowerCase();

      const map = {
        練習: 'practice',
        試合: 'game',
        遠征: 'trip',
        off: 'off',
        休み: 'off',
      };

      const normalized =
        map[original] ||
        lower;

      return VALID_SCHEDULE_TYPES.includes(
        normalized
      )
        ? normalized
        : 'practice';
    },

    /**
     * 公開状態を正規化します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeStatus(value) {
      const original =
        this.normalizeText(value);

      const lower =
        original.toLowerCase();

      if (
        original === '公開' ||
        lower === 'published'
      ) {
        return 'published';
      }

      if (
        original === '下書き' ||
        lower === 'draft'
      ) {
        return 'draft';
      }

      return 'published';
    },

    /**
     * 日付をYYYY-MM-DDへ変換します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeDateValue(value) {
      const text =
        this.normalizeText(value);

      if (
        this.isValidDate(text)
      ) {
        return text;
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return '';
      }

      return this.formatDate(date);
    },

    /**
     * 時刻をHH:mmへ変換します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeTimeValue(value) {
      const text =
        this.normalizeText(value);

      const match =
        text.match(
          /^(\d{1,2}):(\d{2})/
        );

      if (!match) {
        return '';
      }

      const hours =
        Number(match[1]);

      const minutes =
        Number(match[2]);

      if (
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return '';
      }

      return `${String(
        hours
      ).padStart(2, '0')}:${String(
        minutes
      ).padStart(2, '0')}`;
    },

    /**
     * datetime-local形式へ変換します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeDateTimeValue(value) {
      const text =
        this.normalizeText(value);

      if (!text) {
        return '';
      }

      if (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
          .test(text)
      ) {
        return text.slice(0, 16);
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return '';
      }

      return `${this.formatDate(
        date
      )}T${String(
        date.getHours()
      ).padStart(2, '0')}:${String(
        date.getMinutes()
      ).padStart(2, '0')}`;
    },

    /**
     * 真偽値へ変換します。
     *
     * @param {unknown} value
     * @returns {boolean}
     */
    toBoolean(value) {
      if (
        value === true ||
        value === 1
      ) {
        return true;
      }

      const text =
        this.normalizeText(value)
          .toLowerCase();

      return [
        'true',
        '1',
        'yes',
        'on',
        '終日',
      ].includes(text);
    },

    /**
     * 文字列を正規化します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeText(value) {
      if (
        value === null ||
        value === undefined
      ) {
        return '';
      }

      return String(value).trim();
    },

    /**
     * YYYY-MM-DD形式か確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidDate(value) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          value
        )
      ) {
        return false;
      }

      const [
        year,
        month,
        day,
      ] = value
        .split('-')
        .map(Number);

      const date =
        new Date(
          year,
          month - 1,
          day
        );

      return (
        date.getFullYear() ===
          year &&
        date.getMonth() ===
          month - 1 &&
        date.getDate() ===
          day
      );
    },

    /**
     * DateをYYYY-MM-DDへ変換します。
     *
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
      const year =
        date.getFullYear();

      const month =
        String(
          date.getMonth() + 1
        ).padStart(2, '0');

      const day =
        String(
          date.getDate()
        ).padStart(2, '0');

      return `${year}-${month}-${day}`;
    },

    /**
     * IDを生成します。
     *
     * @returns {string}
     */
    createId() {
      if (
        typeof crypto !==
          'undefined' &&
        typeof crypto.randomUUID ===
          'function'
      ) {
        return crypto.randomUUID();
      }

      return [
        'schedule',
        Date.now(),
        Math.random()
          .toString(16)
          .slice(2),
      ].join('-');
    },

    /**
     * 値を複製します。
     *
     * @param {unknown} value
     * @returns {any}
     */
    clone(value) {
      if (
        typeof structuredClone ===
        'function'
      ) {
        return structuredClone(
          value
        );
      }

      return JSON.parse(
        JSON.stringify(value)
      );
    },
  };

  window.NinjaState = State;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      State.init();
    }
  );
})();