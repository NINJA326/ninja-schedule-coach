'use strict';

/**
 * NINJA SCHEDULE
 * ui.js
 *
 * メニュー、予定フォーム、予定詳細、
 * 編集、削除、複写などの画面操作を管理します。
 */

(function () {
  const SCHEDULE_TYPE_LABELS = Object.freeze({
    practice: '🏀 練習',
    game: '🏆 試合',
    trip: '🚐 遠征',
    off: '❌ OFF',
  });

  const CATEGORY_LABELS = Object.freeze({
    'boys-all': '男子全体',
    'girls-all': '女子全体',
    'boys-u13': '男子U13',
    'girls-u13': '女子U13',
    'boys-u14': '男子U14',
    'girls-u14': '女子U14',
    'boys-u15': '男子U15',
    'girls-u15': '女子U15',
  });

  const STATUS_LABELS = Object.freeze({
    published: '公開',
    draft: '下書き',
  });

  const UI = {
    selectedScheduleId: '',

    elements: {
      menuButton: null,
      appMenu: null,

      addScheduleButton: null,
      scheduleDialog: null,
      scheduleForm: null,
      scheduleDialogTitle: null,
      closeScheduleDialogButton: null,
      cancelScheduleButton: null,

      scheduleId: null,
      scheduleDate: null,
      scheduleAllDay: null,
      scheduleStartTime: null,
      scheduleEndTime: null,
      scheduleMeetingTime: null,
      scheduleTimeFields: null,

      scheduleFormStatus: null,
      scheduleFormStatusMessage: null,

      scheduleDetailDialog: null,
      scheduleDetailTitle: null,
      scheduleDetailContent: null,
      closeScheduleDetailButton: null,
      editScheduleButton: null,
      copyScheduleButton: null,
      deleteScheduleButton: null,
    },

    /**
     * UIを初期化します。
     */
    init() {
      this.cacheElements();

      if (!this.validateRequiredElements()) {
        return;
      }

      this.bindEvents();
      this.initializeFormState();
    },

    /**
     * 使用するHTML要素を取得します。
     */
    cacheElements() {
      this.elements.menuButton =
        document.getElementById('menu-button');

      this.elements.appMenu =
        document.getElementById('app-menu');

      this.elements.addScheduleButton =
        document.getElementById('add-schedule-button');

      this.elements.scheduleDialog =
        document.getElementById('schedule-dialog');

      this.elements.scheduleForm =
        document.getElementById('schedule-form');

      this.elements.scheduleDialogTitle =
        document.getElementById('schedule-dialog-title');

      this.elements.closeScheduleDialogButton =
        document.getElementById(
          'close-schedule-dialog-button'
        );

      this.elements.cancelScheduleButton =
        document.getElementById(
          'cancel-schedule-button'
        );

      this.elements.scheduleId =
        document.getElementById('schedule-id');

      this.elements.scheduleDate =
        document.getElementById('schedule-date');

      this.elements.scheduleAllDay =
        document.getElementById('schedule-all-day');

      this.elements.scheduleStartTime =
        document.getElementById('schedule-start-time');

      this.elements.scheduleEndTime =
        document.getElementById('schedule-end-time');

      this.elements.scheduleMeetingTime =
        document.getElementById('schedule-meeting-time');

      this.elements.scheduleTimeFields =
        document.getElementById('schedule-time-fields');

      this.elements.scheduleFormStatus =
        document.getElementById('schedule-form-status');

      this.elements.scheduleFormStatusMessage =
        document.getElementById(
          'schedule-form-status-message'
        );

      this.elements.scheduleDetailDialog =
        document.getElementById(
          'schedule-detail-dialog'
        );

      this.elements.scheduleDetailTitle =
        document.getElementById(
          'schedule-detail-title'
        );

      this.elements.scheduleDetailContent =
        document.getElementById(
          'schedule-detail-content'
        );

      this.elements.closeScheduleDetailButton =
        document.getElementById(
          'close-schedule-detail-button'
        );

      this.elements.editScheduleButton =
        document.getElementById(
          'edit-schedule-button'
        );

      this.elements.copyScheduleButton =
        document.getElementById(
          'copy-schedule-button'
        );

      this.elements.deleteScheduleButton =
        document.getElementById(
          'delete-schedule-button'
        );
    },

    /**
     * 必須要素を確認します。
     *
     * @returns {boolean}
     */
    validateRequiredElements() {
      const requiredElements = [
        this.elements.menuButton,
        this.elements.appMenu,
        this.elements.addScheduleButton,
        this.elements.scheduleDialog,
        this.elements.scheduleForm,
        this.elements.scheduleDialogTitle,
        this.elements.closeScheduleDialogButton,
        this.elements.cancelScheduleButton,
        this.elements.scheduleDate,
        this.elements.scheduleAllDay,
        this.elements.scheduleStartTime,
        this.elements.scheduleEndTime,
        this.elements.scheduleMeetingTime,
        this.elements.scheduleTimeFields,
        this.elements.scheduleDetailDialog,
        this.elements.scheduleDetailTitle,
        this.elements.scheduleDetailContent,
        this.elements.closeScheduleDetailButton,
        this.elements.editScheduleButton,
        this.elements.copyScheduleButton,
        this.elements.deleteScheduleButton,
      ];

      const isValid = requiredElements.every(
        (element) => element !== null
      );

      if (!isValid) {
        console.error(
          'UIの初期化に必要なHTML要素が見つかりません。'
        );
      }

      return isValid;
    },

    /**
     * 操作イベントを登録します。
     */
    bindEvents() {
      this.elements.menuButton.addEventListener(
        'click',
        () => {
          this.toggleMenu();
        }
      );

      this.elements.addScheduleButton.addEventListener(
        'click',
        () => {
          this.openScheduleDialog();
        }
      );

      this.elements.closeScheduleDialogButton.addEventListener(
        'click',
        () => {
          this.closeScheduleDialog();
        }
      );

      this.elements.cancelScheduleButton.addEventListener(
        'click',
        () => {
          this.closeScheduleDialog();
        }
      );

      this.elements.scheduleAllDay.addEventListener(
        'change',
        () => {
          this.updateAllDayState();
        }
      );

      this.elements.scheduleDialog.addEventListener(
        'click',
        (event) => {
          if (
            event.target ===
            this.elements.scheduleDialog
          ) {
            this.closeScheduleDialog();
          }
        }
      );

      this.elements.scheduleDialog.addEventListener(
        'cancel',
        (event) => {
          event.preventDefault();
          this.closeScheduleDialog();
        }
      );

      this.elements.closeScheduleDetailButton
        .addEventListener(
          'click',
          () => {
            this.closeScheduleDetail();
          }
        );

      this.elements.scheduleDetailDialog
        .addEventListener(
          'click',
          (event) => {
            if (
              event.target ===
              this.elements.scheduleDetailDialog
            ) {
              this.closeScheduleDetail();
            }
          }
        );

      this.elements.scheduleDetailDialog
        .addEventListener(
          'cancel',
          (event) => {
            event.preventDefault();
            this.closeScheduleDetail();
          }
        );

      this.elements.editScheduleButton.addEventListener(
        'click',
        () => {
          this.editSelectedSchedule();
        }
      );

      this.elements.copyScheduleButton.addEventListener(
        'click',
        () => {
          this.copySelectedSchedule();
        }
      );

      this.elements.deleteScheduleButton.addEventListener(
        'click',
        () => {
          this.deleteSelectedSchedule();
        }
      );

      document.addEventListener(
        'keydown',
        (event) => {
          if (
            event.key === 'Escape' &&
            !this.elements.appMenu.hidden
          ) {
            this.closeMenu();
          }
        }
      );
    },

    /**
     * フォームの初期状態を設定します。
     */
    initializeFormState() {
      this.setDefaultDate();
      this.updateAllDayState();
      this.hideFormStatus();
    },

    /**
     * メニューを開閉します。
     */
    toggleMenu() {
      const willOpen =
        this.elements.appMenu.hidden;

      this.elements.appMenu.hidden =
        !willOpen;

      this.elements.menuButton.setAttribute(
        'aria-expanded',
        String(willOpen)
      );
    },

    /**
     * メニューを閉じます。
     */
    closeMenu() {
      this.elements.appMenu.hidden = true;

      this.elements.menuButton.setAttribute(
        'aria-expanded',
        'false'
      );
    },

    /**
     * 新規予定フォームを開きます。
     *
     * @param {string} initialDate 初期表示日
     */
    openScheduleDialog(initialDate = '') {
      this.resetScheduleForm();

      this.elements.scheduleDialogTitle.textContent =
        '予定追加';

      if (
        initialDate &&
        this.isValidDateKey(initialDate)
      ) {
        this.elements.scheduleDate.value =
          initialDate;
      }

      this.closeMenu();

      if (
        typeof this.elements.scheduleDialog.showModal !==
        'function'
      ) {
        console.error(
          'このブラウザはdialog要素に対応していません。'
        );

        return;
      }

      this.elements.scheduleDialog.showModal();

      window.requestAnimationFrame(() => {
        const firstInput =
          this.elements.scheduleForm.querySelector(
            'input[name="scheduleType"]'
          );

        if (firstInput) {
          firstInput.focus();
        }
      });
    },

    /**
     * 編集用フォームを開きます。
     *
     * @param {Object} schedule
     */
    openScheduleEditDialog(schedule) {
      if (!schedule) {
        return;
      }

      this.resetScheduleForm();
      this.populateScheduleForm(schedule);

      this.elements.scheduleDialogTitle.textContent =
        '予定編集';

      this.closeScheduleDetail();

      if (
        typeof this.elements.scheduleDialog.showModal ===
        'function'
      ) {
        this.elements.scheduleDialog.showModal();
      }
    },

    /**
     * 複写用フォームを開きます。
     *
     * @param {Object} schedule
     */
    openScheduleCopyDialog(schedule) {
      if (!schedule) {
        return;
      }

      const copiedSchedule = {
        ...schedule,
        id: '',
        title: `${schedule.title}（複写）`,
      };

      this.resetScheduleForm();
      this.populateScheduleForm(copiedSchedule);

      this.elements.scheduleDialogTitle.textContent =
        '予定複写';

      this.closeScheduleDetail();

      if (
        typeof this.elements.scheduleDialog.showModal ===
        'function'
      ) {
        this.elements.scheduleDialog.showModal();
      }
    },

    /**
     * 予定フォームを閉じます。
     */
    closeScheduleDialog() {
      if (this.elements.scheduleDialog.open) {
        this.elements.scheduleDialog.close();
      }

      this.hideFormStatus();
    },

    /**
     * 予定フォームを初期化します。
     */
    resetScheduleForm() {
      this.elements.scheduleForm.reset();

      if (this.elements.scheduleId) {
        this.elements.scheduleId.value = '';
      }

      const practiceRadio =
        this.elements.scheduleForm.querySelector(
          'input[name="scheduleType"][value="practice"]'
        );

      if (practiceRadio) {
        practiceRadio.checked = true;
      }

      const publishedStatus =
        document.getElementById('schedule-status');

      if (publishedStatus) {
        publishedStatus.value = 'published';
      }

      this.setDefaultDate();
      this.clearValidationErrors();
      this.hideFormStatus();
      this.updateAllDayState();
    },

    /**
     * 予定データをフォームへ設定します。
     *
     * @param {Object} schedule
     */
    populateScheduleForm(schedule) {
      this.setInputValue(
        'schedule-id',
        schedule.id || ''
      );

      const scheduleTypeInput =
        this.elements.scheduleForm.querySelector(
          `input[name="scheduleType"][value="${schedule.scheduleType}"]`
        );

      if (scheduleTypeInput) {
        scheduleTypeInput.checked = true;
      }

      const selectedCategories =
        Array.isArray(schedule.categories)
          ? schedule.categories
          : [];

      this.elements.scheduleForm
        .querySelectorAll(
          'input[name="categories"]'
        )
        .forEach((input) => {
          input.checked =
            selectedCategories.includes(input.value);
        });

      this.setInputValue(
        'schedule-title',
        schedule.title
      );

      this.setInputValue(
        'schedule-date',
        schedule.date
      );

      this.elements.scheduleAllDay.checked =
        Boolean(schedule.allDay);

      this.setInputValue(
        'schedule-start-time',
        schedule.startTime
      );

      this.setInputValue(
        'schedule-end-time',
        schedule.endTime
      );

      this.setInputValue(
        'schedule-meeting-time',
        schedule.meetingTime
      );

      this.setInputValue(
        'schedule-location',
        schedule.location
      );

      this.setInputValue(
        'schedule-map-url',
        schedule.mapUrl
      );

      this.setInputValue(
        'schedule-attendance-deadline',
        schedule.attendanceDeadline
      );

      this.setInputValue(
        'schedule-belongings',
        schedule.belongings
      );

      this.setInputValue(
        'schedule-description',
        schedule.description
      );

      this.setInputValue(
        'schedule-coach-note',
        schedule.coachNote
      );

      this.setInputValue(
        'schedule-status',
        schedule.status || 'draft'
      );

      this.updateAllDayState();
    },

    /**
     * 入力欄へ値を設定します。
     *
     * @param {string} elementId
     * @param {unknown} value
     */
    setInputValue(elementId, value) {
      const element =
        document.getElementById(elementId);

      if (!element) {
        return;
      }

      element.value =
        value === null ||
        value === undefined
          ? ''
          : String(value);
    },

    /**
     * 日付入力へ今日を設定します。
     */
    setDefaultDate() {
      if (!this.elements.scheduleDate) {
        return;
      }

      this.elements.scheduleDate.value =
        this.formatDateKey(new Date());
    },

    /**
     * 終日予定に合わせて時間入力を切り替えます。
     */
    updateAllDayState() {
      const isAllDay =
        this.elements.scheduleAllDay.checked;

      const timeInputs = [
        this.elements.scheduleStartTime,
        this.elements.scheduleEndTime,
        this.elements.scheduleMeetingTime,
      ];

      timeInputs.forEach((input) => {
        input.disabled = isAllDay;

        if (isAllDay) {
          input.value = '';
        }
      });

      this.elements.scheduleTimeFields.setAttribute(
        'aria-disabled',
        String(isAllDay)
      );

      this.elements.scheduleTimeFields.style.opacity =
        isAllDay ? '0.55' : '1';

      const meetingField =
        this.elements.scheduleMeetingTime.closest(
          '.form-field'
        );

      if (meetingField) {
        meetingField.style.opacity =
          isAllDay ? '0.55' : '1';
      }
    },

    /**
     * 予定詳細画面を開きます。
     *
     * @param {string} scheduleId
     */
    openScheduleDetail(scheduleId) {
      if (
        !window.NinjaState ||
        typeof window.NinjaState.getScheduleById !==
          'function'
      ) {
        return;
      }

      const schedule =
        window.NinjaState.getScheduleById(
          scheduleId
        );

      if (!schedule) {
        this.showApplicationStatus(
          'error',
          '予定が見つかりませんでした。'
        );

        return;
      }

      this.selectedScheduleId =
        schedule.id;

      this.renderScheduleDetail(schedule);

      if (
        typeof this.elements.scheduleDetailDialog.showModal ===
        'function'
      ) {
        this.elements.scheduleDetailDialog.showModal();
      }
    },

    /**
     * 予定詳細を描画します。
     *
     * @param {Object} schedule
     */
    renderScheduleDetail(schedule) {
      this.elements.scheduleDetailTitle.textContent =
        schedule.title;

      this.elements.scheduleDetailContent.innerHTML =
        '';

      const detailList =
        document.createElement('dl');

      detailList.className =
        'schedule-detail-list';

      this.appendDetailRow(
        detailList,
        '予定種別',
        SCHEDULE_TYPE_LABELS[
          schedule.scheduleType
        ] || '予定'
      );

      this.appendDetailRow(
        detailList,
        '対象カテゴリー',
        this.getCategoryText(
          schedule.categories
        )
      );

      this.appendDetailRow(
        detailList,
        '日付',
        this.formatJapaneseDate(
          schedule.date
        )
      );

      this.appendDetailRow(
        detailList,
        '時間',
        this.getScheduleTimeText(
          schedule
        )
      );

      if (schedule.meetingTime) {
        this.appendDetailRow(
          detailList,
          '集合時間',
          schedule.meetingTime
        );
      }

      if (schedule.location) {
        this.appendDetailRow(
          detailList,
          '会場・集合場所',
          schedule.location
        );
      }

      if (schedule.mapUrl) {
        this.appendLinkDetailRow(
          detailList,
          'Googleマップ',
          schedule.mapUrl,
          '地図を開く'
        );
      }

      if (schedule.attendanceDeadline) {
        this.appendDetailRow(
          detailList,
          '出欠回答締切',
          this.formatDateTime(
            schedule.attendanceDeadline
          )
        );
      }

      if (schedule.belongings) {
        this.appendDetailRow(
          detailList,
          '持ち物',
          schedule.belongings,
          true
        );
      }

      if (schedule.description) {
        this.appendDetailRow(
          detailList,
          '予定詳細',
          schedule.description,
          true
        );
      }

      if (schedule.coachNote) {
        this.appendDetailRow(
          detailList,
          'コーチ内部メモ',
          schedule.coachNote,
          true
        );
      }

      this.appendDetailRow(
        detailList,
        '公開状態',
        STATUS_LABELS[schedule.status] ||
          schedule.status
      );

      this.elements.scheduleDetailContent.appendChild(
        detailList
      );
    },

    /**
     * 詳細表示へ1行追加します。
     *
     * @param {HTMLDListElement} list
     * @param {string} label
     * @param {string} value
     * @param {boolean} multiline
     */
    appendDetailRow(
      list,
      label,
      value,
      multiline = false
    ) {
      const row =
        document.createElement('div');

      row.className =
        'schedule-detail-list__row';

      const term =
        document.createElement('dt');

      term.textContent = label;

      const description =
        document.createElement('dd');

      description.textContent =
        value || '未設定';

      if (multiline) {
        description.style.whiteSpace =
          'pre-wrap';
      }

      row.appendChild(term);
      row.appendChild(description);
      list.appendChild(row);
    },

    /**
     * リンク付き詳細行を追加します。
     *
     * @param {HTMLDListElement} list
     * @param {string} label
     * @param {string} url
     * @param {string} linkText
     */
    appendLinkDetailRow(
      list,
      label,
      url,
      linkText
    ) {
      const row =
        document.createElement('div');

      row.className =
        'schedule-detail-list__row';

      const term =
        document.createElement('dt');

      term.textContent = label;

      const description =
        document.createElement('dd');

      const link =
        document.createElement('a');

      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = linkText;

      description.appendChild(link);
      row.appendChild(term);
      row.appendChild(description);
      list.appendChild(row);
    },

    /**
     * 詳細画面を閉じます。
     */
    closeScheduleDetail() {
      if (
        this.elements.scheduleDetailDialog.open
      ) {
        this.elements.scheduleDetailDialog.close();
      }
    },

    /**
     * 選択中の予定を編集します。
     */
    editSelectedSchedule() {
      const schedule =
        this.getSelectedSchedule();

      if (!schedule) {
        return;
      }

      this.openScheduleEditDialog(schedule);
    },

    /**
     * 選択中の予定を複写します。
     */
    copySelectedSchedule() {
      const schedule =
        this.getSelectedSchedule();

      if (!schedule) {
        return;
      }

      this.openScheduleCopyDialog(schedule);
    },

    /**
     * 選択中の予定を削除します。
     */
    deleteSelectedSchedule() {
      const schedule =
        this.getSelectedSchedule();

      if (!schedule) {
        return;
      }

      const confirmed =
        window.confirm(
          `「${schedule.title}」を削除します。\nこの操作は元に戻せません。`
        );

      if (!confirmed) {
        return;
      }

      try {
        const deleted =
          window.NinjaState.deleteSchedule(
            schedule.id
          );

        if (!deleted) {
          throw new Error(
            '削除対象の予定が見つかりません。'
          );
        }

        this.closeScheduleDetail();
        this.selectedScheduleId = '';

        if (
          window.NinjaApp &&
          typeof window.NinjaApp.renderApplication ===
            'function'
        ) {
          window.NinjaApp.renderApplication();
        } else if (
          window.NinjaCalendar &&
          typeof window.NinjaCalendar.render ===
            'function'
        ) {
          window.NinjaCalendar.render();
        }

        this.showApplicationStatus(
          'success',
          '予定を削除しました。'
        );
      } catch (error) {
        console.error(
          '予定の削除に失敗しました。',
          error
        );

        this.showApplicationStatus(
          'error',
          error instanceof Error
            ? error.message
            : '予定を削除できませんでした。'
        );
      }
    },

    /**
     * 選択中の予定を取得します。
     *
     * @returns {Object|null}
     */
    getSelectedSchedule() {
      if (
        !this.selectedScheduleId ||
        !window.NinjaState
      ) {
        return null;
      }

      const schedule =
        window.NinjaState.getScheduleById(
          this.selectedScheduleId
        );

      if (!schedule) {
        this.showApplicationStatus(
          'error',
          '予定が見つかりませんでした。'
        );

        return null;
      }

      return schedule;
    },

    /**
     * 日別予定一覧を表示します。
     *
     * 現段階では複数予定の選択一覧を
     * 詳細ダイアログ内に表示します。
     *
     * @param {string} dateKey
     * @param {Object[]} schedules
     */
    openDateScheduleList(
      dateKey,
      schedules
    ) {
      if (
        !Array.isArray(schedules) ||
        schedules.length === 0
      ) {
        return;
      }

      this.selectedScheduleId = '';

      this.elements.scheduleDetailTitle.textContent =
        `${this.formatJapaneseDate(dateKey)}の予定`;

      this.elements.scheduleDetailContent.innerHTML =
        '';

      const list =
        document.createElement('div');

      list.className =
        'schedule-list';

      schedules.forEach((schedule) => {
        const button =
          document.createElement('button');

        button.type = 'button';
        button.className =
          'schedule-card';

        button.dataset.scheduleId =
          schedule.id;

        const mark =
          document.createElement('span');

        mark.className =
          'schedule-card__mark';

        mark.dataset.scheduleType =
          schedule.scheduleType;

        const content =
          document.createElement('span');

        content.className =
          'schedule-card__content';

        const title =
          document.createElement('strong');

        title.className =
          'schedule-card__title';

        title.textContent =
          schedule.title;

        const meta =
          document.createElement('span');

        meta.className =
          'schedule-card__meta';

        meta.textContent =
          this.getScheduleTimeText(
            schedule
          );

        content.appendChild(title);
        content.appendChild(meta);

        button.appendChild(mark);
        button.appendChild(content);

        button.addEventListener(
          'click',
          () => {
            this.closeScheduleDetail();

            window.setTimeout(() => {
              this.openScheduleDetail(
                schedule.id
              );
            }, 50);
          }
        );

        list.appendChild(button);
      });

      this.elements.scheduleDetailContent.appendChild(
        list
      );

      this.elements.editScheduleButton.hidden =
        true;

      this.elements.copyScheduleButton.hidden =
        true;

      this.elements.deleteScheduleButton.hidden =
        true;

      this.elements.scheduleDetailDialog.showModal();

      this.elements.scheduleDetailDialog.addEventListener(
        'close',
        () => {
          this.elements.editScheduleButton.hidden =
            false;

          this.elements.copyScheduleButton.hidden =
            false;

          this.elements.deleteScheduleButton.hidden =
            false;
        },
        {
          once: true,
        }
      );
    },

    /**
     * 入力エラー表示を消します。
     */
    clearValidationErrors() {
      const errorElements =
        this.elements.scheduleForm.querySelectorAll(
          '.form-field__error'
        );

      errorElements.forEach((element) => {
        element.hidden = true;
        element.textContent = '';
      });

      const invalidElements =
        this.elements.scheduleForm.querySelectorAll(
          '[aria-invalid="true"]'
        );

      invalidElements.forEach((element) => {
        element.removeAttribute(
          'aria-invalid'
        );
      });
    },

    /**
     * フォーム内ステータスを表示します。
     *
     * @param {'success'|'warning'|'error'|'info'} status
     * @param {string} message
     */
    showFormStatus(status, message) {
      if (
        !this.elements.scheduleFormStatus ||
        !this.elements.scheduleFormStatusMessage
      ) {
        return;
      }

      this.elements.scheduleFormStatus.dataset.status =
        status;

      this.elements.scheduleFormStatusMessage.textContent =
        message;

      this.elements.scheduleFormStatus.hidden =
        false;
    },

    /**
     * フォーム内ステータスを非表示にします。
     */
    hideFormStatus() {
      if (
        !this.elements.scheduleFormStatus ||
        !this.elements.scheduleFormStatusMessage
      ) {
        return;
      }

      this.elements.scheduleFormStatus.hidden =
        true;

      this.elements.scheduleFormStatus.removeAttribute(
        'data-status'
      );

      this.elements.scheduleFormStatusMessage.textContent =
        '';
    },

    /**
     * 画面上部へ状態メッセージを表示します。
     *
     * @param {string} status
     * @param {string} message
     */
    showApplicationStatus(status, message) {
      if (
        window.NinjaApp &&
        typeof window.NinjaApp.showApplicationStatus ===
          'function'
      ) {
        window.NinjaApp.showApplicationStatus(
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
     * カテゴリー表示文を作成します。
     *
     * @param {string[]} categories
     * @returns {string}
     */
    getCategoryText(categories) {
      if (!Array.isArray(categories)) {
        return '未設定';
      }

      return categories
        .map(
          (category) =>
            CATEGORY_LABELS[category] ||
            category
        )
        .join('、');
    },

    /**
     * 予定時間の表示文を作成します。
     *
     * @param {Object} schedule
     * @returns {string}
     */
    getScheduleTimeText(schedule) {
      if (schedule.allDay) {
        return '終日';
      }

      if (
        schedule.startTime &&
        schedule.endTime
      ) {
        return `${schedule.startTime}〜${schedule.endTime}`;
      }

      if (schedule.startTime) {
        return `${schedule.startTime}開始`;
      }

      return '時間未設定';
    },

    /**
     * 日付を日本語形式にします。
     *
     * @param {string} dateKey
     * @returns {string}
     */
    formatJapaneseDate(dateKey) {
      if (!this.isValidDateKey(dateKey)) {
        return dateKey || '未設定';
      }

      const [
        year,
        month,
        day,
      ] = dateKey
        .split('-')
        .map(Number);

      const date =
        new Date(
          year,
          month - 1,
          day
        );

      const weekdays = [
        '日',
        '月',
        '火',
        '水',
        '木',
        '金',
        '土',
      ];

      return `${year}年${month}月${day}日（${weekdays[date.getDay()]}）`;
    },

    /**
     * datetime-localを表示用へ変換します。
     *
     * @param {string} value
     * @returns {string}
     */
    formatDateTime(value) {
      if (!value) {
        return '未設定';
      }

      const parts =
        value.split('T');

      if (parts.length !== 2) {
        return value;
      }

      return `${this.formatJapaneseDate(
        parts[0]
      )} ${parts[1]}`;
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
        ).padStart(2, '0');

      const day =
        String(
          date.getDate()
        ).padStart(2, '0');

      return `${year}-${month}-${day}`;
    },

    /**
     * YYYY-MM-DD形式を確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidDateKey(value) {
      return (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
      );
    },
  };

  window.NinjaUI = UI;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      UI.init();
    }
  );
})();