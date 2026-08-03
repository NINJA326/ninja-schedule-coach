'use strict';

/**
 * NINJA SCHEDULE
 * app.js
 *
 * アプリ全体の制御と予定保存処理を管理します。
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
     * 必須要素と機能を確認します。
     *
     * @returns {boolean}
     */
    validateRequiredElements() {
      const hasElements =
        Boolean(
          this.elements.scheduleForm &&
          this.elements.saveScheduleButton
        );

      if (!hasElements) {
        console.error(
          'アプリ初期化に必要なHTML要素が見つかりません。'
        );

        return false;
      }

      if (
        !window.NinjaState ||
        typeof window.NinjaState
          .saveSchedule !== 'function'
      ) {
        console.error(
          '予定データ管理機能が読み込まれていません。'
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
        'storage',
        (event) => {
          if (
            event.key ===
            'ninja-schedule-coach-schedules-v1'
          ) {
            window.NinjaState.init();
            this.renderApplication();
          }
        }
      );
    },

    /**
     * 予定フォームを保存します。
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
        const scheduleData =
          this.prepareScheduleData(
            validationResult.data
          );

        const saveResult =
          window.NinjaState.saveSchedule(
            scheduleData
          );

        this.renderApplication();

        const successMessage =
          saveResult.action === 'updated'
            ? '予定を更新しました。'
            : '予定を保存しました。';

        this.showApplicationStatus(
          'success',
          successMessage
        );

        this.closeScheduleDialogAfterSave();
      } catch (error) {
        console.error(
          '予定の保存に失敗しました。',
          error
        );

        this.showFormStatus(
          'error',
          error instanceof Error
            ? error.message
            : '予定を保存できませんでした。'
        );
      } finally {
        this.setSubmittingState(false);
      }
    },

    /**
     * 保存用データを整形します。
     *
     * @param {Object} formData
     * @returns {Object}
     */
    prepareScheduleData(formData) {
      return {
        id:
          formData.id || '',

        scheduleType:
          formData.scheduleType,

        categories:
          Array.isArray(
            formData.categories
          )
            ? [...formData.categories]
            : [],

        title:
          formData.title,

        date:
          formData.date,

        allDay:
          Boolean(formData.allDay),

        startTime:
          formData.allDay
            ? ''
            : formData.startTime || '',

        endTime:
          formData.allDay
            ? ''
            : formData.endTime || '',

        meetingTime:
          formData.allDay
            ? ''
            : formData.meetingTime || '',

        location:
          formData.location || '',

        mapUrl:
          formData.mapUrl || '',

        attendanceDeadline:
          formData.attendanceDeadline || '',

        belongings:
          formData.belongings || '',

        description:
          formData.description || '',

        coachNote:
          formData.coachNote || '',

        status:
          formData.status || 'draft',
      };
    },

    /**
     * 男子全体・女子全体の選択状態を調整します。
     *
     * 男子全体を選択した場合は男子U13〜U15を解除します。
     * 男子U13〜U15を選択した場合は男子全体を解除します。
     * 女子も同じルールです。
     *
     * @param {HTMLInputElement} changedInput
     */
    handleCategorySelection(
      changedInput
    ) {
      if (!changedInput.checked) {
        return;
      }

      const value =
        changedInput.value;

      const groups = {
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

      if (groups[value]) {
        this.setCategoryCheckedState(
          groups[value],
          false
        );

        return;
      }

      if (value.startsWith('boys-u')) {
        this.setCategoryCheckedState(
          ['boys-all'],
          false
        );
      }

      if (value.startsWith('girls-u')) {
        this.setCategoryCheckedState(
          ['girls-all'],
          false
        );
      }
    },

    /**
     * 指定カテゴリーのチェック状態を変更します。
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
            input.checked = checked;
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

      if (!container) {
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

      if (schedules.length === 0) {
        const message =
          document.createElement('p');

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

      content.appendChild(title);
      content.appendChild(meta);

      card.appendChild(mark);
      card.appendChild(content);
      card.appendChild(actionButton);

      return card;
    },

    /**
     * 予定カードの補足情報を作成します。
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
      } else if (schedule.startTime) {
        const timeText =
          schedule.endTime
            ? `${schedule.startTime}〜${schedule.endTime}`
            : schedule.startTime;

        parts.push(timeText);
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
     * 予定詳細画面を開きます。
     *
     * 現在のui.jsに詳細機能があれば利用します。
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

        return;
      }

      console.log(
        '予定詳細:',
        window.NinjaState
          .getScheduleById(
            scheduleId
          )
      );
    },

    /**
     * 保存後に予定フォームを閉じます。
     */
    closeScheduleDialogAfterSave() {
      window.setTimeout(
        () => {
          if (
            window.NinjaUI &&
            typeof window.NinjaUI
              .closeScheduleDialog ===
              'function'
          ) {
            window.NinjaUI
              .closeScheduleDialog();
          }

          this.elements.scheduleForm.reset();

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
        350
      );
    },

    /**
     * 送信中の状態を切り替えます。
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

      this.elements.scheduleForm.setAttribute(
        'aria-busy',
        String(isSubmitting)
      );
    },

    /**
     * フォーム内メッセージを表示します。
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
        console.error(message);
      } else {
        console.log(message);
      }
    },

    /**
     * 画面上部へメッセージを表示します。
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

      this.elements.statusPanel.dataset.status =
        status;

      this.elements.statusMessage.textContent =
        message;

      this.elements.statusPanel.hidden =
        false;

      window.setTimeout(
        () => {
          this.hideApplicationStatus();
        },
        4000
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

      this.elements.statusPanel.hidden =
        true;

      this.elements.statusPanel
        .removeAttribute(
          'data-status'
        );

      this.elements.statusMessage.textContent =
        '';
    },

    /**
     * DateをYYYY-MM-DDへ変換します。
     *
     * @param {Date} date
     * @returns {string}
     */
    formatDateKey(
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