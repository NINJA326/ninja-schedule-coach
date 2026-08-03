'use strict';

/**
 * NINJA SCHEDULE
 * api.js
 *
 * Google Apps Script Web APIとの通信を担当します。
 *
 * 公開関数:
 * - NinjaApi.health()
 * - NinjaApi.getSchedules()
 * - NinjaApi.getScheduleById()
 * - NinjaApi.getSchedulesByDateRange()
 * - NinjaApi.createSchedule()
 * - NinjaApi.updateSchedule()
 * - NinjaApi.deleteSchedule()
 */

(function () {
  const DEFAULT_TIMEOUT_MS = 30000;

  /**
   * API通信専用エラーです。
   */
  class NinjaApiError extends Error {
    /**
     * @param {string} message
     * @param {{
     *   errorCode?: string,
     *   status?: number,
     *   action?: string,
     *   details?: unknown
     * }} [options]
     */
    constructor(message, options = {}) {
      super(message);

      this.name = 'NinjaApiError';
      this.errorCode =
        options.errorCode || 'API_ERROR';
      this.status =
        Number(options.status) || 0;
      this.action =
        options.action || '';
      this.details =
        options.details ?? null;
    }
  }

  const Api = {
    /**
     * API設定を取得します。
     *
     * @returns {{
     *   baseUrl: string,
     *   timeoutMs: number,
     *   actions: Record<string, string>
     * }}
     */
    getSettings() {
      const config =
        window.NinjaConfig ||
        window.APP_CONFIG ||
        window.CONFIG;

      if (!config?.API) {
        throw new NinjaApiError(
          'API設定が読み込まれていません。',
          {
            errorCode: 'API_CONFIG_MISSING',
          }
        );
      }

      const baseUrl =
        String(
          config.API.BASE_URL ||
          config.API.URL ||
          ''
        ).trim();

      if (!baseUrl) {
        throw new NinjaApiError(
          'APIの接続先URLが設定されていません。',
          {
            errorCode: 'API_URL_MISSING',
          }
        );
      }

      if (!this.isValidHttpsUrl(baseUrl)) {
        throw new NinjaApiError(
          'APIの接続先URLが正しくありません。',
          {
            errorCode: 'API_URL_INVALID',
          }
        );
      }

      return {
        baseUrl,
        timeoutMs:
          Number(config.API.TIMEOUT_MS) ||
          DEFAULT_TIMEOUT_MS,
        actions:
          config.API.ACTIONS || {},
      };
    },

    /**
     * APIの稼働状態を確認します。
     *
     * @returns {Promise<unknown>}
     */
    async health() {
      const settings =
        this.getSettings();

      const action =
        settings.actions.HEALTH ||
        'health';

      return this.get(action);
    },

    /**
     * 予定一覧を取得します。
     *
     * @param {{
     *   status?: string,
     *   category?: string
     * }} [filters]
     * @returns {Promise<unknown>}
     */
    async getSchedules(filters = {}) {
      const settings =
        this.getSettings();

      const action =
        settings.actions
          .SCHEDULE_GET_ALL ||
        'schedule.getAll';

      return this.get(action, {
        status:
          this.normalizeText(
            filters.status
          ),
        category:
          this.normalizeText(
            filters.category
          ),
      });
    },

    /**
     * 予定をIDで1件取得します。
     *
     * @param {string} scheduleId
     * @returns {Promise<unknown>}
     */
    async getScheduleById(scheduleId) {
      const normalizedId =
        this.normalizeText(scheduleId);

      if (!normalizedId) {
        throw new NinjaApiError(
          '取得する予定IDが指定されていません。',
          {
            errorCode:
              'SCHEDULE_ID_REQUIRED',
            action:
              'schedule.getById',
          }
        );
      }

      const settings =
        this.getSettings();

      const action =
        settings.actions
          .SCHEDULE_GET_BY_ID ||
        'schedule.getById';

      return this.get(action, {
        id: normalizedId,
        scheduleId: normalizedId,
      });
    },

    /**
     * 指定期間の予定を取得します。
     *
     * @param {string} startDate YYYY-MM-DD
     * @param {string} endDate YYYY-MM-DD
     * @param {{
     *   status?: string,
     *   category?: string
     * }} [filters]
     * @returns {Promise<unknown>}
     */
    async getSchedulesByDateRange(
      startDate,
      endDate,
      filters = {}
    ) {
      const normalizedStartDate =
        this.normalizeText(startDate);

      const normalizedEndDate =
        this.normalizeText(endDate);

      if (
        !this.isValidDateKey(
          normalizedStartDate
        ) ||
        !this.isValidDateKey(
          normalizedEndDate
        )
      ) {
        throw new NinjaApiError(
          '予定取得期間の日付が正しくありません。',
          {
            errorCode:
              'DATE_RANGE_INVALID',
            action:
              'schedule.getByDateRange',
          }
        );
      }

      if (
        normalizedStartDate >
        normalizedEndDate
      ) {
        throw new NinjaApiError(
          '終了日は開始日以降に設定してください。',
          {
            errorCode:
              'DATE_RANGE_REVERSED',
            action:
              'schedule.getByDateRange',
          }
        );
      }

      const settings =
        this.getSettings();

      const action =
        settings.actions
          .SCHEDULE_GET_BY_DATE_RANGE ||
        'schedule.getByDateRange';

      return this.get(action, {
        startDate:
          normalizedStartDate,
        endDate:
          normalizedEndDate,
        status:
          this.normalizeText(
            filters.status
          ),
        category:
          this.normalizeText(
            filters.category
          ),
      });
    },

    /**
     * 予定を新規登録します。
     *
     * @param {Object} scheduleData
     * @returns {Promise<unknown>}
     */
    async createSchedule(
      scheduleData
    ) {
      if (
        !scheduleData ||
        typeof scheduleData !== 'object' ||
        Array.isArray(scheduleData)
      ) {
        throw new NinjaApiError(
          '登録する予定データが正しくありません。',
          {
            errorCode:
              'SCHEDULE_DATA_INVALID',
            action:
              'schedule.create',
          }
        );
      }

      const settings =
        this.getSettings();

      const action =
        settings.actions
          .SCHEDULE_CREATE ||
        'schedule.create';

      return this.post(action, {
        schedule:
          this.clone(scheduleData),

        /*
         * GAS側がpayload直下の予定項目を
         *参照する実装にも対応します。
         */
        ...this.clone(scheduleData),
      });
    },

    /**
     * 予定を更新します。
     *
     * @param {string} scheduleId
     * @param {Object} scheduleData
     * @returns {Promise<unknown>}
     */
    async updateSchedule(
      scheduleId,
      scheduleData
    ) {
      const normalizedId =
        this.normalizeText(scheduleId);

      if (!normalizedId) {
        throw new NinjaApiError(
          '更新する予定IDが指定されていません。',
          {
            errorCode:
              'SCHEDULE_ID_REQUIRED',
            action:
              'schedule.update',
          }
        );
      }

      if (
        !scheduleData ||
        typeof scheduleData !== 'object' ||
        Array.isArray(scheduleData)
      ) {
        throw new NinjaApiError(
          '更新する予定データが正しくありません。',
          {
            errorCode:
              'SCHEDULE_DATA_INVALID',
            action:
              'schedule.update',
          }
        );
      }

      const settings =
        this.getSettings();

      const action =
        settings.actions
          .SCHEDULE_UPDATE ||
        'schedule.update';

      const normalizedSchedule = {
        ...this.clone(scheduleData),
        id: normalizedId,
      };

      return this.post(action, {
        id: normalizedId,
        scheduleId: normalizedId,
        schedule:
          normalizedSchedule,

        /*
         * GAS側がpayload直下を参照する場合にも
         * 対応できるよう予定項目を展開します。
         */
        ...normalizedSchedule,
      });
    },

    /**
     * 予定を削除します。
     *
     * @param {string} scheduleId
     * @returns {Promise<unknown>}
     */
    async deleteSchedule(scheduleId) {
      const normalizedId =
        this.normalizeText(scheduleId);

      if (!normalizedId) {
        throw new NinjaApiError(
          '削除する予定IDが指定されていません。',
          {
            errorCode:
              'SCHEDULE_ID_REQUIRED',
            action:
              'schedule.delete',
          }
        );
      }

      const settings =
        this.getSettings();

      const action =
        settings.actions
          .SCHEDULE_DELETE ||
        'schedule.delete';

      return this.post(action, {
        id: normalizedId,
        scheduleId: normalizedId,
      });
    },

    /**
     * GET通信を行います。
     *
     * @param {string} action
     * @param {Record<string, unknown>} [params]
     * @returns {Promise<unknown>}
     */
    async get(action, params = {}) {
      const normalizedAction =
        this.requireAction(action);

      const settings =
        this.getSettings();

      const url =
        this.buildGetUrl(
          settings.baseUrl,
          normalizedAction,
          params
        );

      return this.request(url, {
        method: 'GET',
        action: normalizedAction,
        timeoutMs:
          settings.timeoutMs,
      });
    },

    /**
     * POST通信を行います。
     *
     * application/jsonはCORSプリフライトが
     * 発生するため、GAS Webアプリと相性のよい
     * text/plainでJSON文字列を送信します。
     *
     * @param {string} action
     * @param {Record<string, unknown>} [payload]
     * @returns {Promise<unknown>}
     */
    async post(action, payload = {}) {
      const normalizedAction =
        this.requireAction(action);

      const settings =
        this.getSettings();

      const body = JSON.stringify({
        action:
          normalizedAction,
        data:
          this.clone(payload),
        payload:
          this.clone(payload),

        /*
         * GAS側が本文直下を参照する場合にも対応。
         */
        ...this.clone(payload),
      });

      return this.request(
        settings.baseUrl,
        {
          method: 'POST',
          action:
            normalizedAction,
          timeoutMs:
            settings.timeoutMs,
          headers: {
            'Content-Type':
              'text/plain;charset=UTF-8',
          },
          body,
        }
      );
    },

    /**
     * 共通HTTP通信を行います。
     *
     * @param {string} url
     * @param {{
     *   method: 'GET'|'POST',
     *   action: string,
     *   timeoutMs: number,
     *   headers?: Record<string, string>,
     *   body?: string
     * }} options
     * @returns {Promise<unknown>}
     */
    async request(url, options) {
      const controller =
        new AbortController();

      const timeoutId =
        window.setTimeout(
          () => {
            controller.abort();
          },
          options.timeoutMs
        );

      try {
        const response =
          await window.fetch(url, {
            method:
              options.method,
            headers:
              options.headers || {},
            body:
              options.body,
            signal:
              controller.signal,
            redirect: 'follow',
            cache: 'no-store',
            credentials: 'omit',
          });

        const responseText =
          await response.text();

        const parsedResponse =
          this.parseResponseText(
            responseText,
            options.action,
            response.status
          );

        if (!response.ok) {
          throw new NinjaApiError(
            this.extractMessage(
              parsedResponse
            ) ||
              `API通信に失敗しました。HTTP ${response.status}`,
            {
              errorCode:
                this.extractErrorCode(
                  parsedResponse
                ) ||
                'HTTP_ERROR',
              status:
                response.status,
              action:
                options.action,
              details:
                parsedResponse,
            }
          );
        }

        return this.normalizeApiResponse(
          parsedResponse,
          options.action,
          response.status
        );
      } catch (error) {
        if (
          error instanceof
          NinjaApiError
        ) {
          throw error;
        }

        if (
          error?.name ===
          'AbortError'
        ) {
          throw new NinjaApiError(
            'API通信がタイムアウトしました。通信環境を確認して、もう一度お試しください。',
            {
              errorCode:
                'API_TIMEOUT',
              action:
                options.action,
            }
          );
        }

        console.error(
          'API通信に失敗しました。',
          {
            action:
              options.action,
            error,
          }
        );

        throw new NinjaApiError(
          'APIへ接続できませんでした。通信環境またはGASの公開設定を確認してください。',
          {
            errorCode:
              'NETWORK_ERROR',
            action:
              options.action,
            details:
              error,
          }
        );
      } finally {
        window.clearTimeout(
          timeoutId
        );
      }
    },

    /**
     * APIレスポンスを統一形式へ変換します。
     *
     * GAS v12.1.0のsuccess形式と、
     * 旧APIのok形式の両方に対応します。
     *
     * @param {unknown} response
     * @param {string} action
     * @param {number} status
     * @returns {unknown}
     */
    normalizeApiResponse(
      response,
      action,
      status
    ) {
      if (
        !response ||
        typeof response !== 'object' ||
        Array.isArray(response)
      ) {
        throw new NinjaApiError(
          'APIから正しい形式のレスポンスが返りませんでした。',
          {
            errorCode:
              'API_RESPONSE_INVALID',
            status,
            action,
            details:
              response,
          }
        );
      }

      const hasSuccess =
        Object.prototype
          .hasOwnProperty.call(
            response,
            'success'
          );

      const hasOk =
        Object.prototype
          .hasOwnProperty.call(
            response,
            'ok'
          );

      const isSuccess =
        hasSuccess
          ? response.success === true
          : hasOk
            ? response.ok === true
            : response.error == null;

      if (!isSuccess) {
        throw new NinjaApiError(
          this.extractMessage(
            response
          ) ||
            'API処理に失敗しました。',
          {
            errorCode:
              this.extractErrorCode(
                response
              ) ||
              'API_OPERATION_FAILED',
            status,
            action,
            details:
              response,
          }
        );
      }

      /*
       * 呼び出し側では業務データだけを扱えるよう、
       * dataが存在する場合はdataを返します。
       */
      if (
        Object.prototype
          .hasOwnProperty.call(
            response,
            'data'
          )
      ) {
        return response.data;
      }

      return response;
    },

    /**
     * GET用URLを生成します。
     *
     * @param {string} baseUrl
     * @param {string} action
     * @param {Record<string, unknown>} params
     * @returns {string}
     */
    buildGetUrl(
      baseUrl,
      action,
      params
    ) {
      const url =
        new URL(baseUrl);

      url.searchParams.set(
        'action',
        action
      );

      Object.entries(
        params || {}
      ).forEach(
        ([key, value]) => {
          if (
            value === '' ||
            value === null ||
            value === undefined
          ) {
            return;
          }

          if (Array.isArray(value)) {
            url.searchParams.set(
              key,
              value.join(',')
            );

            return;
          }

          if (
            typeof value ===
            'object'
          ) {
            url.searchParams.set(
              key,
              JSON.stringify(value)
            );

            return;
          }

          url.searchParams.set(
            key,
            String(value)
          );
        }
      );

      return url.toString();
    },

    /**
     * レスポンス文字列をJSONへ変換します。
     *
     * @param {string} responseText
     * @param {string} action
     * @param {number} status
     * @returns {unknown}
     */
    parseResponseText(
      responseText,
      action,
      status
    ) {
      const normalizedText =
        String(
          responseText || ''
        ).trim();

      if (!normalizedText) {
        throw new NinjaApiError(
          'APIから空のレスポンスが返りました。',
          {
            errorCode:
              'API_RESPONSE_EMPTY',
            action,
            status,
          }
        );
      }

      try {
        return JSON.parse(
          normalizedText
        );
      } catch (error) {
        console.error(
          'APIレスポンスのJSON解析に失敗しました。',
          {
            action,
            status,
            responseText:
              normalizedText,
            error,
          }
        );

        throw new NinjaApiError(
          'APIからJSON形式ではないレスポンスが返りました。',
          {
            errorCode:
              'API_RESPONSE_PARSE_ERROR',
            action,
            status,
            details:
              normalizedText,
          }
        );
      }
    },

    /**
     * アクション名を検証します。
     *
     * @param {unknown} action
     * @returns {string}
     */
    requireAction(action) {
      const normalizedAction =
        this.normalizeText(action);

      if (!normalizedAction) {
        throw new NinjaApiError(
          'APIアクションが指定されていません。',
          {
            errorCode:
              'API_ACTION_REQUIRED',
          }
        );
      }

      return normalizedAction;
    },

    /**
     * レスポンスからメッセージを取得します。
     *
     * @param {unknown} response
     * @returns {string}
     */
    extractMessage(response) {
      if (
        !response ||
        typeof response !== 'object'
      ) {
        return '';
      }

      return this.normalizeText(
        response.message ||
        response.error?.message ||
        response.data?.message
      );
    },

    /**
     * レスポンスからエラーコードを取得します。
     *
     * @param {unknown} response
     * @returns {string}
     */
    extractErrorCode(response) {
      if (
        !response ||
        typeof response !== 'object'
      ) {
        return '';
      }

      return this.normalizeText(
        response.errorCode ||
        response.error?.code ||
        response.data?.errorCode
      );
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
    isValidDateKey(value) {
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
     * HTTPS URLか確認します。
     *
     * @param {string} value
     * @returns {boolean}
     */
    isValidHttpsUrl(value) {
      try {
        const url =
          new URL(value);

        return (
          url.protocol ===
            'https:' &&
          url.hostname ===
            'script.google.com'
        );
      } catch (error) {
        return false;
      }
    },

    /**
     * オブジェクトを複製します。
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

  window.NinjaApi = Api;
  window.NinjaApiError =
    NinjaApiError;
})();