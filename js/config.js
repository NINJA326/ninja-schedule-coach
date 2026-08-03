'use strict';

/**
 * NINJA SCHEDULE
 * config.js
 *
 * アプリ全体で使用する設定値を管理します。
 * API URL以外の秘密情報は記載しないでください。
 */

(function () {
  const API_BASE_URL =
    'https://script.google.com/macros/s/AKfycbx_SBI38cJqdYtnIyeicdnpnTMu4wG67pak-tR3JwqyLHNoyUGxQ_NulmCJsxLF9_Q/exec';

  const Config = Object.freeze({
    APP: Object.freeze({
      NAME: 'NINJA SCHEDULE',
      DISPLAY_NAME: 'NINJA SCHEDULE コーチ用',
      VERSION: '1.0.0',
      ENVIRONMENT: 'production',
    }),

    API: Object.freeze({
      BASE_URL: API_BASE_URL,
      URL: API_BASE_URL,
      TIMEOUT_MS: 30000,

      ACTIONS: Object.freeze({
        HEALTH: 'health',

        SCHEDULE_GET_ALL: 'schedule.getAll',
        SCHEDULE_GET_BY_ID: 'schedule.getById',
        SCHEDULE_GET_BY_DATE_RANGE:
          'schedule.getByDateRange',
        SCHEDULE_CREATE: 'schedule.create',
        SCHEDULE_UPDATE: 'schedule.update',
        SCHEDULE_DELETE: 'schedule.delete',

        ATTENDANCE_GET_BY_SCHEDULE:
          'attendance.getBySchedule',
      }),
    }),

    STORAGE: Object.freeze({
      SCHEDULES_KEY:
        'ninja-schedule-coach-schedules-v1',
      SELECTED_CATEGORY_KEY:
        'ninja-schedule-coach-selected-category',
    }),

    SCHEDULE_TYPES: Object.freeze({
      PRACTICE: 'practice',
      GAME: 'game',
      TRIP: 'trip',
      OFF: 'off',
    }),

    CATEGORIES: Object.freeze([
      'boys-all',
      'girls-all',
      'boys-u13',
      'girls-u13',
      'boys-u14',
      'girls-u14',
      'boys-u15',
      'girls-u15',
    ]),

    STATUS: Object.freeze({
      PUBLISHED: 'published',
      DRAFT: 'draft',
    }),
  });

  /*
   * 既存コードとの互換性を維持するため、
   * 複数の参照名を公開しています。
   */
  window.NinjaConfig = Config;
  window.APP_CONFIG = Config;
  window.CONFIG = Config;
})();