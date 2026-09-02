/** GET /users/{id} response — used to resolve a sync run's raw triggeredBy id to a display email. */
export interface UserSummary {
  id: string
  email: string
}
