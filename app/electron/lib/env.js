const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..', '..', '..')

function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  const env = {}
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) env[key.trim()] = rest.join('=').trim()
    }
  }
  return {
    token: env['ZEPHYR_TOKEN'] || process.env.ZEPHYR_TOKEN || '',
    project: env['JIRA_PROJECT'] || process.env.JIRA_PROJECT || 'DEV',
    jiraBaseUrl: (env['JIRA_BASE_URL'] || process.env.JIRA_BASE_URL || '').replace(/\/$/, ''),
    jiraEmail: env['JIRA_EMAIL'] || process.env.JIRA_EMAIL || '',
    jiraApiToken: env['JIRA_API_TOKEN'] || process.env.JIRA_API_TOKEN || '',
    confluenceBddPageId: env['CONFLUENCE_BDD_PAGE_ID'] || process.env.CONFLUENCE_BDD_PAGE_ID || '',
    confluenceQaNotesUrl: env['CONFLUENCE_QA_NOTES_URL'] || process.env.CONFLUENCE_QA_NOTES_URL || '',
    confluenceGherkinUrl: env['CONFLUENCE_GHERKIN_URL'] || process.env.CONFLUENCE_GHERKIN_URL || '',
    anthropicKey: env['ANTHROPIC_API_KEY'] || process.env.ANTHROPIC_API_KEY || env['ANTHROPIC_AUTH_TOKEN'] || process.env.ANTHROPIC_AUTH_TOKEN || '',
    anthropicBaseUrl: env['ANTHROPIC_BASE_URL'] || process.env.ANTHROPIC_BASE_URL || '',
    reposBaseDir: env['REPOS_BASE_DIR'] || process.env.REPOS_BASE_DIR || '',
    githubOrg: env['GITHUB_ORG'] || process.env.GITHUB_ORG || '',
    featureStoreS3Bucket: env['FEATURE_STORE_S3_BUCKET'] || process.env.FEATURE_STORE_S3_BUCKET || '',
  }
}

module.exports = { ROOT, loadEnv }
