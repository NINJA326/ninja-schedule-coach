'use strict';

/**
 * NINJA SCHEDULE
 * calendar.js
 *
 * 月間カレンダーの生成、予定表示、
 * 月移動、カテゴリー絞り込みを管理します。
 */

(function () {
  const MAX_VISIBLE_EVENTS_PER_DAY = 3;

  const SCHEDULE_TYPE_LABELS =
    Object.freeze({
      practice: '練習',
      game: '試合',
      trip: '遠征',
      off: 'OFF',
    });

  const CATEGORY_LABELS =
    Object.freeze({
      'boys-all': '男子全体',
      'girls-all': '女子全体',
      'boys-u13': '男子U13',
      'girls-u13': '女子U13',
      'boys-u14': '男子U14',
      'girls-u14': '女子U14',
      'boys-u15': '男子U15',
      'girls-u15': '女子U15',
    });

  const Calendar = {
    currentDate: new Date(),

    selectedCategory: 'all',

    elements: {
      currentMonth: null,
      grid: null,
      previousButton: null,
      todayButton: null,
      nextButton: null,
      categorySelect: null,
    },

    /**
     * カレンダーを初期化します。
     */
    init() {
      this.cacheElements();

      if (!this.validateRequiredElements()) {
        return;
      }

      this.currentDate =
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        );

      this.selectedCategory =
        this.elements.categorySelect.value ||
        'all';

      this.bindEvents();
      this.render();
    },

    /**
     * 使用するHTML要素を取得します。
     */
    cacheElements() {
      this.elements.currentMonth =
        document.getElementById(
          'calendar-current-month'
        );

      this.elements.grid =
        document.getElementById(
          'calendar-grid'
        );

      this.elements.previousButton =
        document.getElementById(
          'previous-month-button'
        );

      this.elements.todayButton =
        document.getElementById(
          'today-button'
        );

      this.elements.nextButton =
        document.getElementById(
          'next-month-button'
        );

      this.elements.categorySelect =
        document.getElementById(
          'category-select'
        );
    },

    /**
     * 必須要素を確認します。
     *
     * @returns {boolean}
     */
    validateRequiredElements() {
      const requiredElements = [
        this.elements.currentMonth,
        this.elements.grid,
        this.elements.previousButton,
        this.elements.todayButton,
        this.elements.nextButton,
        this.elements.categorySelect,
      ];

      const isValid =
        requiredElements.every(
          (element) => element !== null
        );

      if (!isValid) {
        console.error(
          'カレンダーの初期化に必要なHTML要素が見つかりません。'
        );
      }

      return isValid;
    },

    /**
     * 操作イベントを登録します。
     */
    bindEvents() {
      this.elements.previousButton
        .addEventListener(
          'click',
          () => {
            this.moveMonth(-1);
          }
        );

      this.elements.todayButton
        .addEventListener(
          'click',
          () => {
            const today =
              new Date();

            this.currentDate =
              new Date(
                today.getFullYear(),
                today.getMonth(),
                1
              );

            this.render();
          }
        );

      this.elements.nextButton
        .addEventListener(
          'click',
          () => {
            this.moveMonth(1);
          }
        );

      this.elements.categorySelect
        .addEventListener(
          'change',
          () => {
            this.selectedCategory =
              this.elements.categorySelect
                .value || 'all';

            this.render();
          }
        );
    },

    /**
     * 表示月を移動します。
     *
     * @param {number} amount
     */
    moveMonth(amount) {
      const year =
        this.currentDate.getFullYear();

      const month =
        this.currentDate.getMonth();

      this.currentDate =
        new Date(
          year,
          month + amount,
          1
        );

      this.render();
    },

    /**
     * 指定日を含む月を表示します。
     *
     * @param {string|Date} targetDate
     */
    showMonthContainingDate(
      targetDate
    ) {
      const parsedDate =
        targetDate instanceof Date
          ? new Date(targetDate)
          : this.parseDateKey(
              targetDate
            );

      if (
        !(parsedDate instanceof Date) ||
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return;
      }

      this.currentDate =
        new Date(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          1
        );

      this.render();
    },

    /**
     * カレンダー全体を描画します。
     */
    render() {
      if (
        !this.elements.currentMonth ||
        !this.elements.grid
      ) {
        return;
      }

      const year =
        this.currentDate.getFullYear();

      const month =
        this.currentDate.getMonth();

      this.renderTitle(
        year,
        month
      );

      this.renderGrid(
        year,
        month
      );
    },

    /**
     * 表示年月を描画します。
     *
     * @param {number} year
     * @param {number} month
     */
    renderTitle(
      year,
      month
    ) {
      this.elements.currentMonth
        .textContent =
          `${year}年${month + 1}月`;
    },

    /**
     * 月間カレンダーを描画します。
     *
     * @param {number} year
     * @param {number} month
     */
    renderGrid(
      year,
      month
    ) {
      this.elements.grid.innerHTML =
        '';

      const firstDay =
        new Date(
          year,
          month,
          1
        );

      const startDate =
        new Date(
          year,
          month,
          1 - firstDay.getDay()
        );

      const schedules =
        this.getFilteredSchedules();

      const schedulesByDate =
        this.groupSchedulesByDate(
          schedules
        );

      const fragment =
        document.createDocumentFragment();

      for (
        let index = 0;
        index < 42;
        index += 1
      ) {
        const targetDate =
          new Date(startDate);

        targetDate.setDate(
          startDate.getDate() +
            index
        );

        const dateKey =
          this.formatDateKey(
            targetDate
          );

        const daySchedules =
          schedulesByDate.get(
            dateKey
          ) || [];

        const dayElement =
          this.createDayElement(
            targetDate,
            year,
            month,
            daySchedules
          );

        fragment.appendChild(
          dayElement
        );
      }

      this.elements.grid
        .appendChild(fragment);
    },

    /**
     * 現在の絞り込み条件に合う予定を取得します。
     *
     * @returns {Object[]}
     */
    getFilteredSchedules() {
      if (
        !window.NinjaState ||
        typeof window.NinjaState
          .getSchedules !== 'function'
      ) {
        return [];
      }

      const schedules =
        window.NinjaState
          .getSchedules();

      if (
        this.selectedCategory ===
        'all'
      ) {
        return schedules;
      }

      return schedules.filter(
        (schedule) =>
          Array.isArray(
            schedule.categories
          ) &&
          schedule.categories.includes(
            this.selectedCategory
          )
      );
    },

    /**
     * 予定を日付ごとにまとめます。
     *
     * @param {Object[]} schedules
     * @returns {Map<string, Object[]>}
     */
    groupSchedulesByDate(
      schedules
    ) {
      const result =
        new Map();

      schedules.forEach(
        (schedule) => {
          if (!schedule.date) {
            return;
          }

          if (
            !result.has(
              schedule.date
            )
          ) {
            result.set(
              schedule.date,
              []
            );
          }

          result
            .get(schedule.date)
            .push(schedule);
        }
      );

      result.forEach(
        (dateSchedules) => {
          dateSchedules.sort(
            (
              firstSchedule,
              secondSchedule
            ) => {
              const firstTime =
                firstSchedule.allDay
                  ? '00:00'
                  : firstSchedule
                      .startTime ||
                    '23:59';

              const secondTime =
                secondSchedule.allDay
                  ? '00:00'
                  : secondSchedule
                      .startTime ||
                    '23:59';

              return firstTime
                .localeCompare(
                  secondTime
                );
            }
          );
        }
      );

      return result;
    },

    /**
     * 日付セルを作成します。
     *
     * @param {Date} date
     * @param {number} displayedYear
     * @param {number} displayedMonth
     * @param {Object[]} schedules
     * @returns {HTMLElement}
     */
    createDayElement(
      date,
      displayedYear,
      displayedMonth,
      schedules
    ) {
      const day =
        document.createElement(
          'article'
        );

      day.className =
        'calendar-day';

      const isOutsideMonth =
        date.getFullYear() !==
          displayedYear ||
        date.getMonth() !==
          displayedMonth;

      const isToday =
        this.isSameDate(
          date,
          new Date()
        );

      if (isOutsideMonth) {
        day.classList.add(
          'calendar-day--outside'
        );
      }

      if (isToday) {
        day.classList.add(
          'calendar-day--today'
        );
      }

      const dateKey =
        this.formatDateKey(
          date
        );

      day.dataset.date =
        dateKey;

      const header =
        document.createElement(
          'div'
        );

      header.className =
        'calendar-day__header';

      const number =
        document.createElement(
          'time'
        );

      number.className =
        'calendar-day__number';

      number.dateTime =
        dateKey;

      number.textContent =
        String(
          date.getDate()
        );

      header.appendChild(
        number
      );

      const events =
        document.createElement(
          'div'
        );

      events.className =
        'calendar-day__events';

      events.dataset.eventsDate =
        dateKey;

      const visibleSchedules =
        schedules.slice(
          0,
          MAX_VISIBLE_EVENTS_PER_DAY
        );

      visibleSchedules.forEach(
        (schedule) => {
          events.appendChild(
            this.createEventElement(
              schedule
            )
          );
        }
      );

      if (
        schedules.length >
        MAX_VISIBLE_EVENTS_PER_DAY
      ) {
        events.appendChild(
          this.createMoreButton(
            dateKey,
            schedules
          )
        );
      }

      day.appendChild(
        header
      );

      day.appendChild(
        events
      );

      return day;
    },

    /**
     * 予定ラベルを作成します。
     *
     * @param {Object} schedule
     * @returns {HTMLButtonElement}
     */
    createEventElement(
      schedule
    ) {
      const button =
        document.createElement(
          'button'
        );

      button.className =
        'calendar-event';

      button.type =
        'button';

      button.dataset.scheduleId =
        schedule.id;

      button.dataset.scheduleType =
        schedule.scheduleType;

      button.dataset.status =
        schedule.status;

      const mainCategory =
        Array.isArray(
          schedule.categories
        )
          ? schedule.categories[0]
          : '';

      button.dataset.category =
        this.getCategoryGroup(
          mainCategory
        );

      button.textContent =
        this.createEventLabel(
          schedule
        );

      button.title =
        this.createEventTitle(
          schedule
        );

      if (
        schedule.status ===
        'draft'
      ) {
        button.classList.add(
          'calendar-event--draft'
        );
      }

      button.addEventListener(
        'click',
        (event) => {
          event.stopPropagation();

          this.openScheduleDetail(
            schedule.id
          );
        }
      );

      return button;
    },

    /**
     * カレンダー内の予定ラベルを作成します。
     *
     * @param {Object} schedule
     * @returns {string}
     */
    createEventLabel(
      schedule
    ) {
      const parts = [];

      if (
        schedule.status ===
        'draft'
      ) {
        parts.push('下書き');
      }

      if (
        schedule.allDay
      ) {
        parts.push('終日');
      } else if (
        schedule.startTime
      ) {
        parts.push(
          schedule.startTime
        );
      }

      parts.push(
        schedule.title
      );

      return parts.join(' ');
    },

    /**
     * マウスを重ねたときの説明文を作成します。
     *
     * @param {Object} schedule
     * @returns {string}
     */
    createEventTitle(
      schedule
    ) {
      const parts = [];

      parts.push(
        SCHEDULE_TYPE_LABELS[
          schedule.scheduleType
        ] || '予定'
      );

      parts.push(
        schedule.title
      );

      if (
        schedule.allDay
      ) {
        parts.push('終日');
      } else if (
        schedule.startTime
      ) {
        const timeText =
          schedule.endTime
            ? `${schedule.startTime}〜${schedule.endTime}`
            : schedule.startTime;

        parts.push(
          timeText
        );
      }

      if (
        schedule.location
      ) {
        parts.push(
          schedule.location
        );
      }

      if (
        schedule.status ===
        'draft'
      ) {
        parts.push('下書き');
      }

      return parts.join('／');
    },

    /**
     * 表示しきれない予定件数ボタンを作成します。
     *
     * @param {string} dateKey
     * @param {Object[]} schedules
     * @returns {HTMLButtonElement}
     */
    createMoreButton(
      dateKey,
      schedules
    ) {
      const button =
        document.createElement(
          'button'
        );

      button.className =
        'calendar-day__more-button';

      button.type =
        'button';

      const hiddenCount =
        schedules.length -
        MAX_VISIBLE_EVENTS_PER_DAY;

      button.textContent =
        `ほか${hiddenCount}件`;

      button.addEventListener(
        'click',
        (event) => {
          event.stopPropagation();

          this.openDateSchedules(
            dateKey,
            schedules
          );
        }
      );

      return button;
    },

    /**
     * 指定日の予定一覧を開きます。
     *
     * 現段階では最初の予定の詳細を開きます。
     * 日別一覧画面は後続STEPで追加します。
     *
     * @param {string} dateKey
     * @param {Object[]} schedules
     */
    openDateSchedules(
      dateKey,
      schedules
    ) {
      if (
        !Array.isArray(
          schedules
        ) ||
        schedules.length === 0
      ) {
        return;
      }

      if (
        window.NinjaUI &&
        typeof window.NinjaUI
          .openDateScheduleList ===
          'function'
      ) {
        window.NinjaUI
          .openDateScheduleList(
            dateKey,
            schedules
          );

        return;
      }

      this.openScheduleDetail(
        schedules[0].id
      );
    },

    /**
     * 予定詳細画面を開きます。
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
          ?.getScheduleById(
            scheduleId
          )
      );
    },

    /**
     * カテゴリー表示用の大分類を取得します。
     *
     * @param {string} category
     * @returns {'boys'|'girls'|'common'}
     */
    getCategoryGroup(
      category
    ) {
      if (
        category.startsWith(
          'boys-'
        )
      ) {
        return 'boys';
      }

      if (
        category.startsWith(
          'girls-'
        )
      ) {
        return 'girls';
      }

      return 'common';
    },

    /**
     * カテゴリー表示名を取得します。
     *
     * @param {string} category
     * @returns {string}
     */
    getCategoryLabel(
      category
    ) {
      return (
        CATEGORY_LABELS[
          category
        ] || category
      );
    },

    /**
     * 同じ日付か判定します。
     *
     * @param {Date} firstDate
     * @param {Date} secondDate
     * @returns {boolean}
     */
    isSameDate(
      firstDate,
      secondDate
    ) {
      return (
        firstDate.getFullYear() ===
          secondDate.getFullYear() &&
        firstDate.getMonth() ===
          secondDate.getMonth() &&
        firstDate.getDate() ===
          secondDate.getDate()
      );
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

    /**
     * YYYY-MM-DDをDateへ変換します。
     *
     * @param {string} value
     * @returns {Date|null}
     */
    parseDateKey(
      value
    ) {
      if (
        typeof value !==
        'string' ||
        !/^\d{4}-\d{2}-\d{2}$/
          .test(value)
      ) {
        return null;
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

      if (
        date.getFullYear() !==
          year ||
        date.getMonth() !==
          month - 1 ||
        date.getDate() !==
          day
      ) {
        return null;
      }

      return date;
    },
  };

  window.NinjaCalendar =
    Calendar;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      Calendar.init();
    }
  );
})();