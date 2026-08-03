'use strict';

/**
 * NINJA SCHEDULE
 * state.js
 *
 * 予定データの保存・取得・更新・削除を管理します。
 * 現段階ではlocalStorageを使用します。
 */

(function () {
  const STORAGE_KEY =
    'ninja-schedule-coach-schedules-v1';

  const SCHEDULE_TYPES = Object.freeze([
    'practice',
    'game',
    'trip',
    'off',
  ]);

  const CATEGORIES = Object.freeze([
    'boys-all',
    'girls-all',
    'boys-u13',
    'girls-u13',
    'boys-u14',
    'girls-u14',
    'boys-u15',
    'girls-u15',
  ]);

  const STATUSES = Object.freeze([
    'published',
    'draft',
  ]);

  const State = {
    schedules: [],

    /**
     * データ管理を初期化します。
     */
    init() {
      this.schedules =
        this.loadSchedules();

      this.sortSchedules();
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
        this.normalizeText(
          scheduleId
        );

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
        this.normalizeText(
          startDate
        );

      const normalizedEnd =
        this.normalizeText(
          endDate
        );

      if (
        !this.isValidDate(
          normalizedStart
        ) ||
        !this.isValidDate(
          normalizedEnd
        )
      ) {
        return [];
      }

      if (
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
        this.normalizeText(
          category
        );

      if (
        normalizedCategory ===
        'all'
      ) {
        return this.getSchedules();
      }

      if (
        !CATEGORIES.includes(
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
     * 新規予定を保存します。
     *
     * @param {Object} scheduleData
     * @returns {Object}
     */
    createSchedule(
      scheduleData
    ) {
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

      this.validateSchedule(
        schedule
      );

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

      this.schedules.push(
        schedule
      );

      this.sortSchedules();
      this.persistSchedules();

      return this.clone(
        schedule
      );
    },

    /**
     * 予定を更新します。
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
        this.normalizeText(
          scheduleId
        );

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

      this.validateSchedule(
        updated
      );

      this.schedules[index] =
        updated;

      this.sortSchedules();
      this.persistSchedules();

      return this.clone(
        updated
      );
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
    saveSchedule(
      scheduleData
    ) {
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
     * 予定を削除します。
     *
     * @param {string} scheduleId
     * @returns {boolean}
     */
    deleteSchedule(
      scheduleId
    ) {
      const normalizedId =
        this.normalizeText(
          scheduleId
        );

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
     * 予定を複写します。
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
        this.normalizeText(
          newDate
        );

      if (
        !this.isValidDate(
          normalizedDate
        )
      ) {
        throw new Error(
          '複写先の日付が正しくありません。'
        );
      }

      const copiedSchedule = {
        ...source,
        id: '',
        date:
          normalizedDate,
        createdAt: '',
        updatedAt: '',
      };

      return this.createSchedule(
        copiedSchedule
      );
    },

    /**
     * 複数予定を一括複写します。
     *
     * @param {string[]} scheduleIds
     * @param {number} dayOffset
     * @returns {Object[]}
     */
    copySchedulesByDayOffset(
      scheduleIds,
      dayOffset
    ) {
      if (
        !Array.isArray(
          scheduleIds
        )
      ) {
        throw new Error(
          '複写対象が正しくありません。'
        );
      }

      const numericOffset =
        Number(dayOffset);

      if (
        !Number.isInteger(
          numericOffset
        )
      ) {
        throw new Error(
          '複写日数が正しくありません。'
        );
      }

      const copiedSchedules = [];

      scheduleIds.forEach(
        (scheduleId) => {
          const source =
            this.getScheduleById(
              scheduleId
            );

          if (!source) {
            return;
          }

          const sourceDate =
            this.parseDate(
              source.date
            );

          sourceDate.setDate(
            sourceDate.getDate() +
              numericOffset
          );

          const newDate =
            this.formatDate(
              sourceDate
            );

          copiedSchedules.push(
            this.copySchedule(
              source.id,
              newDate
            )
          );
        }
      );

      return copiedSchedules;
    },

    /**
     * すべての予定を削除します。
     * 開発確認用です。
     */
    clearSchedules() {
      this.schedules = [];
      this.persistSchedules();
    },

    /**
     * localStorageから読み込みます。
     *
     * @returns {Object[]}
     */
    loadSchedules() {
      try {
        const stored =
          window.localStorage.getItem(
            STORAGE_KEY
          );

        if (!stored) {
          return [];
        }

        const parsed =
          JSON.parse(stored);

        if (
          !Array.isArray(parsed)
        ) {
          console.warn(
            '保存済み予定データの形式が正しくありません。'
          );

          return [];
        }

        const schedules = [];

        parsed.forEach(
          (item) => {
            try {
              const schedule =
                this.normalizeSchedule(
                  item
                );

              this.validateSchedule(
                schedule
              );

              schedules.push(
                schedule
              );
            } catch (error) {
              console.warn(
                '不正な予定データを除外しました。',
                error,
                item
              );
            }
          }
        );

        return schedules;
      } catch (error) {
        console.error(
          '予定データの読み込みに失敗しました。',
          error
        );

        return [];
      }
    },

    /**
     * localStorageへ保存します。
     */
    persistSchedules() {
      try {
        const serialized =
          JSON.stringify(
            this.schedules
          );

        window.localStorage.setItem(
          STORAGE_KEY,
          serialized
        );
      } catch (error) {
        console.error(
          '予定データの保存に失敗しました。',
          error
        );

        throw new Error(
          '予定を保存できませんでした。ブラウザ設定または保存容量を確認してください。'
        );
      }
    },

    /**
     * 予定データを正規化します。
     *
     * @param {Object} schedule
     * @returns {Object}
     */
    normalizeSchedule(
      schedule
    ) {
      const allDay =
        Boolean(
          schedule?.allDay
        );

      return {
        id:
          this.normalizeText(
            schedule?.id
          ),

        scheduleType:
          this.normalizeText(
            schedule?.scheduleType
          ),

        categories:
          this.normalizeCategories(
            schedule?.categories
          ),

        title:
          this.normalizeText(
            schedule?.title
          ),

        date:
          this.normalizeText(
            schedule?.date
          ),

        allDay,

        startTime:
          allDay
            ? ''
            : this.normalizeText(
                schedule?.startTime
              ),

        endTime:
          allDay
            ? ''
            : this.normalizeText(
                schedule?.endTime
              ),

        meetingTime:
          allDay
            ? ''
            : this.normalizeText(
                schedule?.meetingTime
              ),

        location:
          this.normalizeText(
            schedule?.location
          ),

        mapUrl:
          this.normalizeText(
            schedule?.mapUrl
          ),

        attendanceDeadline:
          this.normalizeText(
            schedule?.attendanceDeadline
          ),

        belongings:
          this.normalizeText(
            schedule?.belongings
          ),

        description:
          this.normalizeText(
            schedule?.description
          ),

        coachNote:
          this.normalizeText(
            schedule?.coachNote
          ),

        status:
          this.normalizeText(
            schedule?.status
          ) || 'draft',

        createdAt:
          this.normalizeText(
            schedule?.createdAt
          ),

        updatedAt:
          this.normalizeText(
            schedule?.updatedAt
          ),
      };
    },

    /**
     * 予定データを検証します。
     *
     * @param {Object} schedule
     */
    validateSchedule(
      schedule
    ) {
      if (!schedule.id) {
        throw new Error(
          '予定IDがありません。'
        );
      }

      if (
        !SCHEDULE_TYPES.includes(
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
          '対象カテゴリーが選択されていません。'
        );
      }

      const invalidCategory =
        schedule.categories.some(
          (category) =>
            !CATEGORIES.includes(
              category
            )
        );

      if (invalidCategory) {
        throw new Error(
          '対象カテゴリーに不正な値があります。'
        );
      }

      if (!schedule.title) {
        throw new Error(
          'タイトルが入力されていません。'
        );
      }

      if (
        schedule.title.length >
        100
      ) {
        throw new Error(
          'タイトルは100文字以内で入力してください。'
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
        !schedule.allDay &&
        schedule.startTime &&
        schedule.endTime &&
        schedule.endTime <=
          schedule.startTime
      ) {
        throw new Error(
          '終了時間は開始時間より後に設定してください。'
        );
      }

      if (
        schedule.mapUrl &&
        !this.isValidHttpUrl(
          schedule.mapUrl
        )
      ) {
        throw new Error(
          'GoogleマップURLが正しくありません。'
        );
      }

      if (
        !STATUSES.includes(
          schedule.status
        )
      ) {
        throw new Error(
          '公開状態が正しくありません。'
        );
      }
    },

    /**
     * 日付・時間順に並び替えます。
     */
    sortSchedules() {
      this.schedules.sort(
        (
          firstSchedule,
          secondSchedule
        ) => {
          const firstKey = [
            firstSchedule.date,
            firstSchedule.allDay
              ? '00:00'
              : firstSchedule.startTime ||
                '23:59',
            firstSchedule.title,
          ].join('|');

          const secondKey = [
            secondSchedule.date,
            secondSchedule.allDay
              ? '00:00'
              : secondSchedule.startTime ||
                '23:59',
            secondSchedule.title,
          ].join('|');

          return firstKey.localeCompare(
            secondKey,
            'ja'
          );
        }
      );
    },

    /**
     * カテゴリー配列を正規化します。
     *
     * @param {unknown} categories
     * @returns {string[]}
     */
    normalizeCategories(
      categories
    ) {
      if (
        !Array.isArray(
          categories
        )
      ) {
        return [];
      }

      return [
        ...new Set(
          categories
            .map(
              (category) =>
                this.normalizeText(
                  category
                )
            )
            .filter(Boolean)
        ),
      ];
    },

    /**
     * 文字列を正規化します。
     *
     * @param {unknown} value
     * @returns {string}
     */
    normalizeText(
      value
    ) {
      if (
        value === null ||
        value === undefined
      ) {
        return '';
      }

      return String(value).trim();
    },

    /**
     * YYYY-MM-DD形式の日付を確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidDate(
      value
    ) {
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
     * URL形式を確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidHttpUrl(
      value
    ) {
      try {
        const url =
          new URL(value);

        return (
          url.protocol ===
            'http:' ||
          url.protocol ===
            'https:'
        );
      } catch (error) {
        return false;
      }
    },

    /**
     * YYYY-MM-DDをDateへ変換します。
     *
     * @param {string} value
     * @returns {Date}
     */
    parseDate(
      value
    ) {
      const [
        year,
        month,
        day,
      ] = value
        .split('-')
        .map(Number);

      return new Date(
        year,
        month - 1,
        day
      );
    },

    /**
     * DateをYYYY-MM-DDへ変換します。
     *
     * @param {Date} date
     * @returns {string}
     */
    formatDate(
      date
    ) {
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
     * データを複製します。
     *
     * @param {unknown} value
     * @returns {any}
     */
    clone(
      value
    ) {
      if (
        typeof structuredClone ===
        'function'
      ) {
        return structuredClone(
          value
        );
      }

      return JSON.parse(
        JSON.stringify(
          value
        )
      );
    },
  };

  window.NinjaState =
    State;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      State.init();
    }
  );
})();