export interface ImportContext {
  /** Подмена fetch в тестах */
  fetchImpl?: typeof fetch;
  /** Повышает лимит GitHub API; клиенту не передаётся */
  githubToken?: string;
}
