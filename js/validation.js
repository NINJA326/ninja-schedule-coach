'use strict';

/**
 * NINJA SCHEDULE
 * validation.js
 *
 * 予定フォームの入力検証とデータ取得を管理します。
 */

(function () {
  const Validation = {
    form: null,

    /**
     * 入力チェック機能を初期化します。
     */
    init() {
      this.form =
        document.getElementById('schedule-form');

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
          const target = event.target;

          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement
          ) {
            this.clearFieldError(target);
          }
        }
      );

      this.form.addEventListener(
        'change',
        (event) => {
          const target = event.target;

          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement
          ) {
            this.clearFieldError(target);
          }

          if (
            target instanceof HTMLInputElement &&
            target.name === 'categories'
          ) {
            this.clearCategoriesError();
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
      let firstInvalidElement = null;

      const setFirstInvalidElement = (element) => {
        if (!firstInvalidElement && element) {
          firstInvalidElement = element;
        }
      };

      if (!formData.scheduleType) {
        isValid = false;

        const scheduleTypeInput =
          this.form.querySelector(
            'input[name="scheduleType"]'
          );

        this.showError(
          'schedule-type-error',
          '予定種別を選択してください。'
        );

        setFirstInvalidElement(scheduleTypeInput);
      }

      if (formData.categories.length === 0) {
        isValid = false;

        const categoryInput =
          this.form.querySelector(
            'input[name="categories"]'
          );

        this.showError(
          'categories-error',
          '対象カテゴリーを1つ以上選択してください。'
        );

        setFirstInvalidElement(categoryInput);
      }

      const titleInput =
        document.getElementById('schedule-title');

      if (!formData.title) {
        isValid = false;

        this.setFieldError(
          titleInput,
          'schedule-title-error',
          'タイトルを入力してください。'
        );

        setFirstInvalidElement(titleInput);
      }

      if (formData.title.length > 100) {
        isValid = false;

        this.setFieldError(
          titleInput,
          'schedule-title-error',
          'タイトルは100文字以内で入力してください。'
        );

        setFirstInvalidElement(titleInput);
      }

      const dateInput =
        document.getElementById('schedule-date');

      if (!formData.date) {
        isValid = false;

        this.setFieldError(
          dateInput,
          'schedule-date-error',
          '日付を入力してください。'
        );

        setFirstInvalidElement(dateInput);
      } else if (!this.isValidDateString(formData.date)) {
        isValid = false;

        this.setFieldError(
          dateInput,
          'schedule-date-error',
          '正しい日付を入力してください。'
        );

        setFirstInvalidElement(dateInput);
      }

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
          formData.startTime &&
          formData.endTime &&
          formData.endTime <= formData.startTime
        ) {
          isValid = false;

          this.setFieldError(
            endTimeInput,
            'schedule-end-time-error',
            '終了時間は開始時間より後に設定してください。'
          );

          setFirstInvalidElement(endTimeInput);
        }

        if (
          formData.meetingTime &&
          formData.startTime &&
          formData.meetingTime > formData.startTime
        ) {
          isValid = false;

          this.setFieldError(
            meetingTimeInput,
            'schedule-start-time-error',
            '集合時間は開始時間以前に設定してください。'
          );

          setFirstInvalidElement(meetingTimeInput);
        }

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

          setFirstInvalidElement(startTimeInput);
        }
      }

      const mapUrlInput =
        document.getElementById(
          'schedule-map-url'
        );

      if (
        formData.mapUrl &&
        !this.isValidHttpUrl(formData.mapUrl)
      ) {
        isValid = false;

        this.setFieldError(
          mapUrlInput,
          'schedule-map-url-error',
          'http:// または https:// から始まる正しいURLを入力してください。'
        );

        setFirstInvalidElement(mapUrlInput);
      }

      if (!isValid && firstInvalidElement) {
        firstInvalidElement.focus();

        firstInvalidElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }

      return {
        isValid,
        data: isValid ? formData : null,
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
        ).map((input) => input.value);

      const getValue = (id) => {
        const element =
          document.getElementById(id);

        if (!element) {
          return '';
        }

        return element.value.trim();
      };

      const allDayInput =
        document.getElementById(
          'schedule-all-day'
        );

      const allDay =
        Boolean(allDayInput?.checked);

      return {
        id: getValue('schedule-id'),

        scheduleType:
          selectedType?.value || '',

        categories:
          this.normalizeCategories(
            selectedCategories
          ),

        title:
          getValue('schedule-title'),

        date:
          getValue('schedule-date'),

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
          getValue('schedule-location'),

        mapUrl:
          getValue('schedule-map-url'),

        attendanceDeadline:
          getValue(
            'schedule-attendance-deadline'
          ),

        belongings:
          getValue('schedule-belongings'),

        description:
          getValue('schedule-description'),

        coachNote:
          getValue('schedule-coach-note'),

        status:
          getValue('schedule-status'),
      };
    },

    /**
     * 「全体」が選択されている場合は、
     * 他のカテゴリーを除外します。
     *
     * @param {string[]} categories
     * @returns {string[]}
     */
    normalizeCategories(categories) {
      if (categories.includes('all')) {
        return ['all'];
      }

      return [...new Set(categories)];
    },

    /**
     * 指定した入力欄にエラーを表示します。
     *
     * @param {HTMLElement|null} input
     * @param {string} errorId
     * @param {string} message
     */
    setFieldError(input, errorId, message) {
      if (input) {
        input.setAttribute(
          'aria-invalid',
          'true'
        );
      }

      this.showError(errorId, message);
    },

    /**
     * エラーメッセージを表示します。
     *
     * @param {string} errorId
     * @param {string} message
     */
    showError(errorId, message) {
      const errorElement =
        document.getElementById(errorId);

      if (!errorElement) {
        return;
      }

      errorElement.textContent = message;
      errorElement.hidden = false;
    },

    /**
     * 指定入力欄のエラーを解除します。
     *
     * @param {HTMLElement} input
     */
    clearFieldError(input) {
      input.removeAttribute('aria-invalid');

      const field =
        input.closest('.form-field');

      if (!field) {
        return;
      }

      const errorElements =
        field.querySelectorAll(
          '.form-field__error'
        );

      errorElements.forEach((element) => {
        element.hidden = true;
        element.textContent = '';
      });
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

      errorElement.hidden = true;
      errorElement.textContent = '';
    },

    /**
     * フォーム内の全エラーを解除します。
     */
    clearAllErrors() {
      const invalidElements =
        this.form.querySelectorAll(
          '[aria-invalid="true"]'
        );

      invalidElements.forEach((element) => {
        element.removeAttribute(
          'aria-invalid'
        );
      });

      const errorElements =
        this.form.querySelectorAll(
          '.form-field__error'
        );

      errorElements.forEach((element) => {
        element.hidden = true;
        element.textContent = '';
      });
    },

    /**
     * YYYY-MM-DD形式の日付を確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidDateString(value) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
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
        new Date(year, month - 1, day);

      return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
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
        const url = new URL(value);

        return (
          url.protocol === 'http:' ||
          url.protocol === 'https:'
        );
      } catch (error) {
        return false;
      }
    },
  };

  window.NinjaValidation = Validation;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      Validation.init();
    }
  );
})();