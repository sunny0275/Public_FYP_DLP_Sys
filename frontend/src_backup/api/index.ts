import { createClient } from './client'
import { createAuthApi } from './auth'
import { createMeApi } from './me'
import { createDashboardApi } from './dashboard'
import { createEdrApi } from './edr'
import { createUebaApi } from './ueba'
import { createAuditApi } from './audit'
import { createSecurityApi } from './security'
import { createComplianceApi } from './compliance'
import { createAdminApi } from './admin'
import { createDocumentApi } from './document'
import { createShareApi } from './share'
import { createWorkflowApi } from './workflow'
import { createClassificationApi } from './classification'
import { createSignatureApi } from './signature'

const client = createClient()

export const apiClient = {
  ...createAuthApi(client),
  ...createMeApi(client),
  ...createDashboardApi(client),
  ...createEdrApi(client),
  ...createUebaApi(client),
  ...createAuditApi(client),
  ...createSecurityApi(client),
  ...createComplianceApi(client),
  ...createAdminApi(client),
  ...createDocumentApi(client),
  ...createShareApi(client),
  ...createWorkflowApi(client),
  ...createClassificationApi(client),
  ...createSignatureApi(client),
}
