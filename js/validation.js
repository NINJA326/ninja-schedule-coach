'use strict';

/**
 * NINJA SCHEDULE
 * validation.js
 *
 * 予定フォームの入力検証とデータ取得を管理します。
 *
 * 対応機能:
 * - 1日登録
 * - 複数日一括登録
 * - 編集時の単一日固定
 * - カテゴリー必須
 * - 時間整合性
 * - URL検証
 */

(function () {
  const Validation = {
    form: null,

    /**
     * 入力チェック機能を初期化します。
     */
    init() {
      this.form =
        document.getElementById(
          'schedule-form'
        );

      if (!this.form) {
        console.error(
          '予定フォームが見つからないため、入力チェックを初期化できません。'
        );

        return;
      }

      this.bindEvents();
    },

    /**
     * 入力中のエラー解除処理を登録します。
     */
    bindEvents() {
      this.form.addEventListener(
        'input',
        (event) => {
          const target =
            event.target;

          if (
            target instanceof
              HTMLInputElement ||
            target instanceof
              HTMLSelectElement ||
            target instanceof
              HTMLTextAreaElement
          ) {
            this.clearFieldError(
              target
            );
          }

          if (
            target instanceof
              HTMLInputElement &&
            target.name ===
              'multipleDates'
          ) {
            this.clearMultipleDatesError();
          }
        }
      );

      this.form.addEventListener(
        'change',
        (event) => {
          const target =
            event.target;

          if (
            target instanceof
              HTMLInputElement ||
            target instanceof
              HTMLSelectElement ||
            target instanceof
              HTMLTextAreaElement
          ) {
            this.clearFieldError(
              target
            );
          }

          if (
            target instanceof
              HTMLInputElement &&
            target.name ===
              'categories'
          ) {
            this.clearCategoriesError();
          }

          if (
            target instanceof
              HTMLInputElement &&
            target.name ===
              'multipleDates'
          ) {
            this.clearMultipleDatesError();
          }

          if (
            target instanceof
              HTMLInputElement &&
            target.name ===
              'dateMode'
          ) {
            this.clearDateErrors();
          }
        }
      );
    },

    /**
     * フォーム全体を検証します。
     *
     * @returns {{
     *   isValid: boolean,
     *   data: Object|null
     * }}
     */
    validateScheduleForm() {
      if (!this.form) {
        return {
          isValid: false,
          data: null,
        };
      }

      this.clearAllErrors();

      const formData =
        this.getScheduleFormData();

      let isValid = true;
      let firstInvalidElement =
        null;

      const setFirstInvalidElement =
        (element) => {
          if (
            !firstInvalidElement &&
            element
          ) {
            firstInvalidElement =
              element;
          }
        };

      /*
       * 予定種別
       */
      if (!formData.scheduleType) {
        isValid = false;

        const input =
          this.form.querySelector(
            'input[name="scheduleType"]'
          );

        this.showError(
          'schedule-type-error',
          '予定種別を選択してください。'
        );

        setFirstInvalidElement(
          input
        );
      }

      /*
       * 対象カテゴリー
       */
      if (
        formData.categories.length ===
        0
      ) {
        isValid = false;

        const input =
          this.form.querySelector(
            'input[name="categories"]'
          );

        this.showError(
          'categories-error',
          '対象カテゴリーを1つ以上選択してください。'
        );

        setFirstInvalidElement(
          input
        );
      }

      /*
       * タイトル
       */
      const titleInput =
        document.getElementById(
          'schedule-title'
        );

      if (!formData.title) {
        isValid = false;

        this.setFieldError(
          titleInput,
          'schedule-title-error',
          'タイトルを入力してください。'
        );

        setFirstInvalidElement(
          titleInput
        );
      } else if (
        formData.title.length >
        100
      ) {
        isValid = false;

        this.setFieldError(
          titleInput,
          'schedule-title-error',
          'タイトルは100文字以内で入力してください。'
        );

        setFirstInvalidElement(
          titleInput
        );
      }

      /*
       * 日付
       */
      if (
        formData.dateMode ===
        'multiple'
      ) {
        const multipleDateInput =
          this.form.querySelector(
            'input[name="multipleDates"]'
          );

        if (
          formData.multipleDates
            .length === 0
        ) {
          isValid = false;

          this.showError(
            'schedule-multiple-dates-error',
            '登録する日付を1つ以上入力してください。'
          );

          multipleDateInput?.setAttribute(
            'aria-invalid',
            'true'
          );

          setFirstInvalidElement(
            multipleDateInput
          );
        }
      } else {
        const dateInput =
          document.getElementById(
            'schedule-date'
          );

        if (!formData.date) {
          isValid = false;

          this.setFieldError(
            dateInput,
            'schedule-date-error',
            '日付を入力してください。'
          );

          setFirstInvalidElement(
            dateInput
          );
        } else if (
          !this.isValidDateString(
            formData.date
          )
        ) {
          isValid = false;

          this.setFieldError(
            dateInput,
            'schedule-date-error',
            '正しい日付を入力してください。'
          );

          setFirstInvalidElement(
            dateInput
          );
        }
      }

      /*
       * 時間
       */
      if (!formData.allDay) {
        const startTimeInput =
          document.getElementById(
            'schedule-start-time'
          );

        const endTimeInput =
          document.getElementById(
            'schedule-end-time'
          );

        const meetingTimeInput =
          document.getElementById(
            'schedule-meeting-time'
          );

        if (
          formData.endTime &&
          !formData.startTime
        ) {
          isValid = false;

          this.setFieldError(
            startTimeInput,
            'schedule-start-time-error',
            '終了時間を設定する場合は開始時間も入力してください。'
          );

          setFirstInvalidElement(
            startTimeInput
          );
        }

        if (
          formData.startTime &&
          formData.endTime &&
          formData.endTime <=
            formData.startTime
        ) {
          isValid = false;

          this.setFieldError(
            endTimeInput,
            'schedule-end-time-error',
            '終了時間は開始時間より後に設定してください。'
          );

          setFirstInvalidElement(
            endTimeInput
          );
        }

        if (
          formData.meetingTime &&
          formData.startTime &&
          formData.meetingTime >
            formData.startTime
        ) {
          isValid = false;

          this.setFieldError(
            meetingTimeInput,
            'schedule-meeting-time-error',
            '集合時間は開始時間以前に設定してください。'
          );

          setFirstInvalidElement(
            meetingTimeInput
          );
        }
      }

      /*
       * GoogleマップURL
       */
      const mapUrlInput =
        document.getElementById(
          'schedule-map-url'
        );

      if (
        formData.mapUrl &&
        !this.isValidHttpUrl(
          formData.mapUrl
        )
      ) {
        isValid = false;

        this.setFieldError(
          mapUrlInput,
          'schedule-map-url-error',
          'http:// または https:// から始まる正しいURLを入力してください。'
        );

        setFirstInvalidElement(
          mapUrlInput
        );
      }

      /*
       * 出欠回答締切
       */
      const deadlineInput =
        document.getElementById(
          'schedule-attendance-deadline'
        );

      if (
        formData.attendanceDeadline &&
        !this.isValidDateTimeLocal(
          formData.attendanceDeadline
        )
      ) {
        isValid = false;

        this.setFieldError(
          deadlineInput,
          'schedule-attendance-deadline-error',
          '正しい回答締切を入力してください。'
        );

        setFirstInvalidElement(
          deadlineInput
        );
      }

      if (
        !isValid &&
        firstInvalidElement
      ) {
        firstInvalidElement.focus();

        firstInvalidElement
          .scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
      }

      return {
        isValid,
        data:
          isValid
            ? formData
            : null,
      };
    },

    /**
     * フォームの入力値を予定データへ変換します。
     *
     * @returns {Object}
     */
    getScheduleFormData() {
      const selectedType =
        this.form.querySelector(
          'input[name="scheduleType"]:checked'
        );

      const selectedCategories =
        Array.from(
          this.form.querySelectorAll(
            'input[name="categories"]:checked'
          )
        ).map(
          (input) =>
            input.value
        );

      const getValue = (id) => {
        const element =
          document.getElementById(
            id
          );

        if (!element) {
          return '';
        }

        return String(
          element.value || ''
        ).trim();
      };

      const allDayInput =
        document.getElementById(
          'schedule-all-day'
        );

      const allDay =
        Boolean(
          allDayInput?.checked
        );

      const dateMode =
        this.getDateMode();

      const multipleDates =
        dateMode === 'multiple'
          ? this.getMultipleDates()
          : [];

      const singleDate =
        getValue(
          'schedule-date'
        );

      /*
       * 既存コードとの互換性のため、
       * 複数日登録時もdateへ最初の日付を設定します。
       */
      const primaryDate =
        dateMode === 'multiple'
          ? multipleDates[0] || ''
          : singleDate;

      return {
        id:
          getValue(
            'schedule-id'
          ),

        scheduleType:
          selectedType?.value ||
          '',

        categories:
          this.normalizeCategories(
            selectedCategories
          ),

        title:
          getValue(
            'schedule-title'
          ),

        dateMode,

        date:
          primaryDate,

        multipleDates,

        allDay,

        startTime:
          allDay
            ? ''
            : getValue(
                'schedule-start-time'
              ),

        endTime:
          allDay
            ? ''
            : getValue(
                'schedule-end-time'
              ),

        meetingTime:
          allDay
            ? ''
            : getValue(
                'schedule-meeting-time'
              ),

        location:
          getValue(
            'schedule-location'
          ),

        mapUrl:
          getValue(
            'schedule-map-url'
          ),

        attendanceDeadline:
          getValue(
            'schedule-attendance-deadline'
          ),

        belongings:
          getValue(
            'schedule-belongings'
          ),

        description:
          getValue(
            'schedule-description'
          ),

        coachNote:
          getValue(
            'schedule-coach-note'
          ),

        status:
          getValue(
            'schedule-status'
          ),
      };
    },

    /**
     * 現在の日付登録方法を取得します。
     *
     * @returns {'single'|'multiple'}
     */
    getDateMode() {
      if (
        window.NinjaUI &&
        typeof window.NinjaUI
          .getDateMode ===
          'function'
      ) {
        return window.NinjaUI
          .getDateMode();
      }

      const multipleInput =
        document.getElementById(
          'schedule-date-mode-multiple'
        );

      return multipleInput?.checked
        ? 'multiple'
        : 'single';
    },

    /**
     * 複数日入力値を取得します。
     *
     * 空欄、不正日付、重複を除外し、
     * 日付順に並べます。
     *
     * @returns {string[]}
     */
    getMultipleDates() {
      let dates = [];

      if (
        window.NinjaUI &&
        typeof window.NinjaUI
          .getSelectedMultipleDates ===
          'function'
      ) {
        dates =
          window.NinjaUI
            .getSelectedMultipleDates();
      } else {
        dates =
          Array.from(
            this.form.querySelectorAll(
              'input[name="multipleDates"]'
            )
          )
            .map(
              (input) =>
                String(
                  input.value || ''
                ).trim()
            );
      }

      return [
        ...new Set(
          dates.filter(
            (date) =>
              this.isValidDateString(
                date
              )
          )
        ),
      ].sort();
    },

    /**
     * カテゴリー配列を正規化します。
     *
     * 男子全体と男子年代、女子全体と女子年代が
     * 同時に含まれた場合は、全体を優先します。
     *
     * @param {string[]} categories
     * @returns {string[]}
     */
    normalizeCategories(categories) {
      const normalized = [
        ...new Set(
          categories
            .map(
              (category) =>
                String(
                  category || ''
                ).trim()
            )
            .filter(Boolean)
        ),
      ];

      const result = [
        ...normalized,
      ];

      if (
        result.includes(
          'boys-all'
        )
      ) {
        this.removeValues(
          result,
          [
            'boys-u13',
            'boys-u14',
            'boys-u15',
          ]
        );
      }

      if (
        result.includes(
          'girls-all'
        )
      ) {
        this.removeValues(
          result,
          [
            'girls-u13',
            'girls-u14',
            'girls-u15',
          ]
        );
      }

      return result;
    },

    /**
     * 配列から指定値を削除します。
     *
     * @param {string[]} target
     * @param {string[]} values
     */
    removeValues(
      target,
      values
    ) {
      values.forEach(
        (value) => {
          const index =
            target.indexOf(
              value
            );

          if (index !== -1) {
            target.splice(
              index,
              1
            );
          }
        }
      );
    },

    /**
     * 指定した入力欄にエラーを表示します。
     *
     * @param {HTMLElement|null} input
     * @param {string} errorId
     * @param {string} message
     */
    setFieldError(
      input,
      errorId,
      message
    ) {
      if (input) {
        input.setAttribute(
          'aria-invalid',
          'true'
        );
      }

      this.showError(
        errorId,
        message
      );
    },

    /**
     * エラーメッセージを表示します。
     *
     * @param {string} errorId
     * @param {string} message
     */
    showError(
      errorId,
      message
    ) {
      const errorElement =
        document.getElementById(
          errorId
        );

      if (!errorElement) {
        return;
      }

      errorElement.textContent =
        message;

      errorElement.hidden =
        false;
    },

    /**
     * 指定入力欄のエラーを解除します。
     *
     * @param {HTMLElement} input
     */
    clearFieldError(input) {
      input.removeAttribute(
        'aria-invalid'
      );

      const field =
        input.closest(
          '.form-field'
        );

      if (!field) {
        return;
      }

      const errorElements =
        field.querySelectorAll(
          '.form-field__error'
        );

      errorElements.forEach(
        (element) => {
          element.hidden =
            true;

          element.textContent =
            '';
        }
      );
    },

    /**
     * カテゴリーエラーを解除します。
     */
    clearCategoriesError() {
      const errorElement =
        document.getElementById(
          'categories-error'
        );

      if (!errorElement) {
        return;
      }

      errorElement.hidden =
        true;

      errorElement.textContent =
        '';
    },

    /**
     * 複数日エラーを解除します。
     */
    clearMultipleDatesError() {
      const errorElement =
        document.getElementById(
          'schedule-multiple-dates-error'
        );

      if (errorElement) {
        errorElement.hidden =
          true;

        errorElement.textContent =
          '';
      }

      this.form
        .querySelectorAll(
          'input[name="multipleDates"]'
        )
        .forEach(
          (input) => {
            input.removeAttribute(
              'aria-invalid'
            );
          }
        );
    },

    /**
     * 単一日・複数日のエラーを解除します。
     */
    clearDateErrors() {
      const singleDateError =
        document.getElementById(
          'schedule-date-error'
        );

      if (singleDateError) {
        singleDateError.hidden =
          true;

        singleDateError.textContent =
          '';
      }

      const dateInput =
        document.getElementById(
          'schedule-date'
        );

      dateInput?.removeAttribute(
        'aria-invalid'
      );

      this.clearMultipleDatesError();
    },

    /**
     * フォーム内の全エラーを解除します。
     */
    clearAllErrors() {
      if (!this.form) {
        return;
      }

      const invalidElements =
        this.form.querySelectorAll(
          '[aria-invalid="true"]'
        );

      invalidElements.forEach(
        (element) => {
          element.removeAttribute(
            'aria-invalid'
          );
        }
      );

      const errorElements =
        this.form.querySelectorAll(
          '.form-field__error'
        );

      errorElements.forEach(
        (element) => {
          element.hidden =
            true;

          element.textContent =
            '';
        }
      );
    },

    /**
     * YYYY-MM-DD形式の日付を確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidDateString(value) {
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
     * datetime-local形式を確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidDateTimeLocal(value) {
      if (
        typeof value !==
          'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
          .test(value)
      ) {
        return false;
      }

      const [
        datePart,
        timePart,
      ] = value.split('T');

      if (
        !this.isValidDateString(
          datePart
        )
      ) {
        return false;
      }

      const [
        hours,
        minutes,
      ] = timePart
        .split(':')
        .map(Number);

      return (
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59
      );
    },

    /**
     * HTTPまたはHTTPSのURLか確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidHttpUrl(value) {
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
  };

  window.NinjaValidation =
    Validation;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      Validation.init();
    }
  );
})();