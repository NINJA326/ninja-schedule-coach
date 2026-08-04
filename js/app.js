'use strict';

/**
 * NINJA SCHEDULE
 * app.js
 *
 * アプリ全体の制御と予定保存処理を管理します。
 *
 * 対応機能:
 * - 予定の新規登録
 * - 予定の編集
 * - 複数日一括登録
 * - GAS保存
 * - 保存後の予定再取得
 * - カレンダー再描画
 */

(function () {
  const App = {
    elements: {
      scheduleForm: null,
      saveScheduleButton: null,
      categoryInputs: [],
      statusPanel: null,
      statusMessage: null,
    },

    isSubmitting: false,
    statusTimerId: null,

    /**
     * アプリを初期化します。
     */
    init() {
      this.cacheElements();

      if (!this.validateRequiredElements()) {
        return;
      }

      this.bindEvents();
      this.renderApplication();
    },

    /**
     * 使用するHTML要素を取得します。
     */
    cacheElements() {
      this.elements.scheduleForm =
        document.getElementById(
          'schedule-form'
        );

      this.elements.saveScheduleButton =
        document.getElementById(
          'save-schedule-button'
        );

      this.elements.categoryInputs =
        Array.from(
          document.querySelectorAll(
            'input[name="categories"]'
          )
        );

      this.elements.statusPanel =
        document.getElementById(
          'status-panel'
        );

      this.elements.statusMessage =
        document.getElementById(
          'status-message'
        );
    },

    /**
     * 必須要素と必要機能を確認します。
     *
     * @returns {boolean}
     */
    validateRequiredElements() {
      const hasRequiredElements =
        Boolean(
          this.elements.scheduleForm &&
          this.elements.saveScheduleButton
        );

      if (!hasRequiredElements) {
        console.error(
          'アプリ初期化に必要なHTML要素が見つかりません。'
        );

        return false;
      }

      if (
        !window.NinjaApi ||
        typeof window.NinjaApi
          .createSchedule !== 'function' ||
        typeof window.NinjaApi
          .updateSchedule !== 'function'
      ) {
        console.error(
          'API通信機能が読み込まれていません。'
        );

        this.showApplicationStatus(
          'error',
          'API通信機能を読み込めませんでした。'
        );

        return false;
      }

      if (
        !window.NinjaState ||
        typeof window.NinjaState
          .refreshFromApi !== 'function'
      ) {
        console.error(
          '予定データ管理機能が読み込まれていません。'
        );

        this.showApplicationStatus(
          'error',
          '予定データ管理機能を読み込めませんでした。'
        );

        return false;
      }

      return true;
    },

    /**
     * 操作イベントを登録します。
     */
    bindEvents() {
      this.elements.scheduleForm.addEventListener(
        'submit',
        (event) => {
          event.preventDefault();
          this.handleScheduleSubmit();
        }
      );

      this.elements.categoryInputs.forEach(
        (input) => {
          input.addEventListener(
            'change',
            () => {
              this.handleCategorySelection(
                input
              );
            }
          );
        }
      );

      window.addEventListener(
        'ninja:schedules-updated',
        () => {
          this.renderApplication();
        }
      );

      window.addEventListener(
        'ninja:schedules-load-error',
        (event) => {
          const message =
            event.detail?.error?.message ||
            '予定の取得に失敗しました。';

          this.showApplicationStatus(
            'error',
            message
          );
        }
      );
    },

    /**
     * 予定フォームの送信を処理します。
     */
    async handleScheduleSubmit() {
      if (this.isSubmitting) {
        return;
      }

      this.hideApplicationStatus();

      if (
        !window.NinjaValidation ||
        typeof window.NinjaValidation
          .validateScheduleForm !== 'function'
      ) {
        this.showFormStatus(
          'error',
          '入力チェック機能を読み込めませんでした。ページを再読み込みしてください。'
        );

        return;
      }

      const validationResult =
        window.NinjaValidation
          .validateScheduleForm();

      if (!validationResult.isValid) {
        this.showFormStatus(
          'error',
          '入力内容を確認してください。'
        );

        return;
      }

      this.setSubmittingState(true);

      try {
        const formData =
          validationResult.data;

        const scheduleData =
          this.prepareScheduleData(
            formData
          );

        const isUpdate =
          Boolean(scheduleData.id);

        if (isUpdate) {
          await this.updateSingleSchedule(
            scheduleData
          );
        } else if (
          formData.dateMode ===
          'multiple'
        ) {
          await this.createMultipleSchedules(
            scheduleData,
            formData.multipleDates
          );
        } else {
          await this.createSingleSchedule(
            scheduleData
          );
        }

        await window.NinjaState
          .refreshFromApi({
            silent: false,
          });

        this.renderApplication();
        this.closeScheduleDialogAfterSave();

        const successMessage =
          isUpdate
            ? '予定を更新しました。'
            : formData.dateMode ===
                'multiple'
              ? `${formData.multipleDates.length}件の予定を登録しました。`
              : '予定を保存しました。';

        this.showApplicationStatus(
          'success',
          successMessage
        );
      } catch (error) {
        console.error(
          '予定の保存に失敗しました。',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : '予定を保存できませんでした。';

        this.showFormStatus(
          'error',
          message
        );
      } finally {
        this.setSubmittingState(false);
      }
    },

    /**
     * 予定を1件新規登録します。
     *
     * @param {Object} scheduleData
     * @returns {Promise<unknown>}
     */
    async createSingleSchedule(
      scheduleData
    ) {
      const createData = {
        ...scheduleData,
      };

      delete createData.id;
      delete createData.dateMode;
      delete createData.multipleDates;

      return window.NinjaApi
        .createSchedule(
          createData
        );
    },

    /**
     * 予定を1件更新します。
     *
     * 編集時は複数日更新を行いません。
     *
     * @param {Object} scheduleData
     * @returns {Promise<unknown>}
     */
    async updateSingleSchedule(
      scheduleData
    ) {
      const updateData = {
        ...scheduleData,
      };

      delete updateData.dateMode;
      delete updateData.multipleDates;

      return window.NinjaApi
        .updateSchedule(
          scheduleData.id,
          updateData
        );
    },

    /**
     * 複数日へ同じ予定を順番に登録します。
     *
     * GASの同時書き込み競合を避けるため、
     * Promise.allではなく1件ずつ処理します。
     *
     * @param {Object} scheduleData
     * @param {string[]} dates
     * @returns {Promise<Object[]>}
     */
    async createMultipleSchedules(
      scheduleData,
      dates
    ) {
      const normalizedDates =
        this.normalizeMultipleDates(
          dates
        );

      if (
        normalizedDates.length === 0
      ) {
        throw new Error(
          '登録する日付がありません。'
        );
      }

      const createdSchedules = [];

      for (
        let index = 0;
        index < normalizedDates.length;
        index += 1
      ) {
        const date =
          normalizedDates[index];

        this.updateSubmittingProgress(
          index + 1,
          normalizedDates.length
        );

        const createData = {
          ...scheduleData,
          date,
        };

        delete createData.id;
        delete createData.dateMode;
        delete createData.multipleDates;

        try {
          const result =
            await window.NinjaApi
              .createSchedule(
                createData
              );

          createdSchedules.push(
            result
          );
        } catch (error) {
          const completedCount =
            createdSchedules.length;

          throw new Error(
            `${date}の予定登録に失敗しました。` +
            (
              completedCount > 0
                ? ` ${completedCount}件は登録済みです。`
                : ''
            ) +
            ` ${this.getErrorMessage(error)}`
          );
        }
      }

      return createdSchedules;
    },

    /**
     * 複数日配列を正規化します。
     *
     * 不正日付、空欄、重複を除外し、
     * 日付順に並べます。
     *
     * @param {unknown} dates
     * @returns {string[]}
     */
    normalizeMultipleDates(dates) {
      if (!Array.isArray(dates)) {
        return [];
      }

      return [
        ...new Set(
          dates
            .map(
              (date) =>
                this.normalizeText(
                  date
                )
            )
            .filter(
              (date) =>
                this.isValidDateKey(
                  date
                )
            )
        ),
      ].sort();
    },

    /**
     * APIへ送信する予定データを整形します。
     *
     * @param {Object} formData
     * @returns {Object}
     */
    prepareScheduleData(formData) {
      const isAllDay =
        Boolean(
          formData.allDay
        );

      return {
        id:
          this.normalizeText(
            formData.id
          ),

        scheduleType:
          this.normalizeText(
            formData.scheduleType
          ),

        categories:
          Array.isArray(
            formData.categories
          )
            ? [
                ...new Set(
                  formData.categories
                    .map(
                      (category) =>
                        this.normalizeText(
                          category
                        )
                    )
                    .filter(Boolean)
                ),
              ]
            : [],

        title:
          this.normalizeText(
            formData.title
          ),

        dateMode:
          formData.dateMode ===
            'multiple'
            ? 'multiple'
            : 'single',

        date:
          this.normalizeText(
            formData.date
          ),

        multipleDates:
          this.normalizeMultipleDates(
            formData.multipleDates
          ),

        allDay:
          isAllDay,

        startTime:
          isAllDay
            ? ''
            : this.normalizeText(
                formData.startTime
              ),

        endTime:
          isAllDay
            ? ''
            : this.normalizeText(
                formData.endTime
              ),

        meetingTime:
          isAllDay
            ? ''
            : this.normalizeText(
                formData.meetingTime
              ),

        location:
          this.normalizeText(
            formData.location
          ),

        mapUrl:
          this.normalizeText(
            formData.mapUrl
          ),

        attendanceDeadline:
          this.normalizeText(
            formData.attendanceDeadline
          ),

        belongings:
          this.normalizeText(
            formData.belongings
          ),

        description:
          this.normalizeText(
            formData.description
          ),

        coachNote:
          this.normalizeText(
            formData.coachNote
          ),

        status:
          this.normalizeText(
            formData.status
          ) || 'draft',
      };
    },

    /**
     * 男子全体・女子全体と各年代の選択を整理します。
     *
     * @param {HTMLInputElement} changedInput
     */
    handleCategorySelection(
      changedInput
    ) {
      if (!changedInput.checked) {
        return;
      }

      const categoryGroups = {
        'boys-all': [
          'boys-u13',
          'boys-u14',
          'boys-u15',
        ],

        'girls-all': [
          'girls-u13',
          'girls-u14',
          'girls-u15',
        ],
      };

      if (
        categoryGroups[
          changedInput.value
        ]
      ) {
        this.setCategoryCheckedState(
          categoryGroups[
            changedInput.value
          ],
          false
        );

        return;
      }

      if (
        changedInput.value.startsWith(
          'boys-u'
        )
      ) {
        this.setCategoryCheckedState(
          ['boys-all'],
          false
        );
      }

      if (
        changedInput.value.startsWith(
          'girls-u'
        )
      ) {
        this.setCategoryCheckedState(
          ['girls-all'],
          false
        );
      }
    },

    /**
     * 指定カテゴリーの選択状態を変更します。
     *
     * @param {string[]} categoryValues
     * @param {boolean} checked
     */
    setCategoryCheckedState(
      categoryValues,
      checked
    ) {
      this.elements.categoryInputs.forEach(
        (input) => {
          if (
            categoryValues.includes(
              input.value
            )
          ) {
            input.checked =
              checked;
          }
        }
      );
    },

    /**
     * アプリ全体を再描画します。
     */
    renderApplication() {
      if (
        window.NinjaCalendar &&
        typeof window.NinjaCalendar
          .render === 'function'
      ) {
        window.NinjaCalendar.render();
      }

      this.renderTodaySchedules();
    },

    /**
     * 今日の予定を表示します。
     */
    renderTodaySchedules() {
      const container =
        document.getElementById(
          'today-schedule-list'
        );

      if (
        !container ||
        !window.NinjaState
      ) {
        return;
      }

      const today =
        this.formatDateKey(
          new Date()
        );

      const schedules =
        window.NinjaState
          .getSchedulesByDate(
            today
          )
          .filter(
            (schedule) =>
              schedule.status ===
              'published'
          );

      container.innerHTML = '';

      if (
        schedules.length === 0
      ) {
        const message =
          document.createElement(
            'p'
          );

        message.className =
          'empty-message';

        message.textContent =
          '今日の予定はありません。';

        container.appendChild(
          message
        );

        return;
      }

      schedules.forEach(
        (schedule) => {
          container.appendChild(
            this.createTodayScheduleCard(
              schedule
            )
          );
        }
      );
    },

    /**
     * 今日の予定カードを作成します。
     *
     * @param {Object} schedule
     * @returns {HTMLElement}
     */
    createTodayScheduleCard(
      schedule
    ) {
      const card =
        document.createElement(
          'article'
        );

      card.className =
        'schedule-card';

      card.dataset.scheduleId =
        schedule.id;

      const mark =
        document.createElement(
          'span'
        );

      mark.className =
        'schedule-card__mark';

      mark.dataset.scheduleType =
        schedule.scheduleType;

      const content =
        document.createElement(
          'div'
        );

      content.className =
        'schedule-card__content';

      const title =
        document.createElement(
          'h3'
        );

      title.className =
        'schedule-card__title';

      title.textContent =
        schedule.title;

      const meta =
        document.createElement(
          'p'
        );

      meta.className =
        'schedule-card__meta';

      meta.textContent =
        this.createScheduleMetaText(
          schedule
        );

      const actionButton =
        document.createElement(
          'button'
        );

      actionButton.className =
        'button button--text schedule-card__action';

      actionButton.type =
        'button';

      actionButton.textContent =
        '詳細';

      actionButton.addEventListener(
        'click',
        () => {
          this.openScheduleDetail(
            schedule.id
          );
        }
      );

      content.appendChild(
        title
      );

      content.appendChild(
        meta
      );

      card.appendChild(
        mark
      );

      card.appendChild(
        content
      );

      card.appendChild(
        actionButton
      );

      return card;
    },

    /**
     * 今日の予定の補足情報を作成します。
     *
     * @param {Object} schedule
     * @returns {string}
     */
    createScheduleMetaText(
      schedule
    ) {
      const parts = [];

      if (schedule.allDay) {
        parts.push('終日');
      } else if (
        schedule.startTime
      ) {
        parts.push(
          schedule.endTime
            ? `${schedule.startTime}〜${schedule.endTime}`
            : `${schedule.startTime}開始`
        );
      }

      if (schedule.location) {
        parts.push(
          schedule.location
        );
      }

      return parts.length > 0
        ? parts.join('／')
        : '時間・会場未設定';
    },

    /**
     * 予定詳細を開きます。
     *
     * @param {string} scheduleId
     */
    openScheduleDetail(
      scheduleId
    ) {
      if (
        window.NinjaUI &&
        typeof window.NinjaUI
          .openScheduleDetail ===
          'function'
      ) {
        window.NinjaUI
          .openScheduleDetail(
            scheduleId
          );
      }
    },

    /**
     * 保存後に予定フォームを閉じて初期化します。
     */
    closeScheduleDialogAfterSave() {
      if (
        window.NinjaUI &&
        typeof window.NinjaUI
          .closeScheduleDialog ===
          'function'
      ) {
        window.NinjaUI
          .closeScheduleDialog();
      }

      this.elements.scheduleForm
        .reset();

      if (
        window.NinjaUI &&
        typeof window.NinjaUI
          .initializeFormState ===
          'function'
      ) {
        window.NinjaUI
          .initializeFormState();
      }
    },

    /**
     * 保存中の状態を切り替えます。
     *
     * @param {boolean} isSubmitting
     */
    setSubmittingState(
      isSubmitting
    ) {
      this.isSubmitting =
        isSubmitting;

      this.elements.saveScheduleButton.disabled =
        isSubmitting;

      this.elements.saveScheduleButton.textContent =
        isSubmitting
          ? '保存中...'
          : '予定を保存';

      this.elements.scheduleForm
        .setAttribute(
          'aria-busy',
          String(isSubmitting)
        );
    },

    /**
     * 複数日保存の進捗を保存ボタンへ表示します。
     *
     * @param {number} current
     * @param {number} total
     */
    updateSubmittingProgress(
      current,
      total
    ) {
      if (!this.isSubmitting) {
        return;
      }

      this.elements.saveScheduleButton.textContent =
        `保存中 ${current}/${total}`;
    },

    /**
     * フォーム内へメッセージを表示します。
     *
     * @param {'success'|'warning'|'error'|'info'} status
     * @param {string} message
     */
    showFormStatus(
      status,
      message
    ) {
      if (
        window.NinjaUI &&
        typeof window.NinjaUI
          .showFormStatus ===
          'function'
      ) {
        window.NinjaUI
          .showFormStatus(
            status,
            message
          );

        return;
      }

      if (status === 'error') {
        console.error(
          message
        );
      } else {
        console.log(
          message
        );
      }
    },

    /**
     * 画面上部へ状態メッセージを表示します。
     *
     * @param {'success'|'warning'|'error'|'info'} status
     * @param {string} message
     */
    showApplicationStatus(
      status,
      message
    ) {
      if (
        !this.elements.statusPanel ||
        !this.elements.statusMessage
      ) {
        return;
      }

      if (this.statusTimerId) {
        window.clearTimeout(
          this.statusTimerId
        );

        this.statusTimerId =
          null;
      }

      this.elements.statusPanel
        .dataset.status =
          status;

      this.elements.statusMessage
        .textContent =
          message;

      this.elements.statusPanel
        .hidden =
          false;

      this.statusTimerId =
        window.setTimeout(
          () => {
            this.hideApplicationStatus();
          },
          5000
        );
    },

    /**
     * 画面上部のメッセージを消します。
     */
    hideApplicationStatus() {
      if (
        !this.elements.statusPanel ||
        !this.elements.statusMessage
      ) {
        return;
      }

      this.elements.statusPanel
        .hidden =
          true;

      this.elements.statusPanel
        .removeAttribute(
          'data-status'
        );

      this.elements.statusMessage
        .textContent =
          '';

      if (this.statusTimerId) {
        window.clearTimeout(
          this.statusTimerId
        );

        this.statusTimerId =
          null;
      }
    },

    /**
     * エラーから表示用メッセージを取得します。
     *
     * @param {unknown} error
     * @returns {string}
     */
    getErrorMessage(error) {
      if (
        error instanceof Error &&
        error.message
      ) {
        return error.message;
      }

      return '通信エラーが発生しました。';
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
     * YYYY-MM-DD形式の日付を確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidDateKey(value) {
      if (
        typeof value !==
          'string' ||
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
    formatDateKey(date) {
      const year =
        date.getFullYear();

      const month =
        String(
          date.getMonth() + 1
        ).padStart(
          2,
          '0'
        );

      const day =
        String(
          date.getDate()
        ).padStart(
          2,
          '0'
        );

      return `${year}-${month}-${day}`;
    },
  };

  window.NinjaApp =
    App;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      App.init();
    }
  );
})();