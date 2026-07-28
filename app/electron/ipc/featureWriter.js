const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn, execSync } = require('child_process')
const { ROOT, loadEnv } = require('../lib/env')
const os = require('os')

const FEATURE_WRITER_DIR = path.join(ROOT, 'feature-writer')

function getS3Config() {
  const { featureStoreS3Bucket } = loadEnv()
  const bucket = featureStoreS3Bucket || 's3://your-feature-store-bucket'
  return {
    S3_BUCKET: bucket,
    S3_PREFIX: `${bucket}/risk-engine-batch-features`,
    S3_SUCCESS_PREFIX: `${bucket}/risk-engine-batch-features-success`,
  }
}
const LOCALSTACK_URL = 'http://localhost:14566/'

function register() {
  ipcMain.handle('feature-writer-run', (event, { families }) => {
    return new Promise((resolve) => {
      const selectedFamilies = families && families.length ? families : ['dae', 'bac', 'over']
      const proc = spawn('python3', [
        path.join(FEATURE_WRITER_DIR, 'main.py'),
        ...selectedFamilies,
      ], { cwd: FEATURE_WRITER_DIR, env: process.env })
      let output = ''
      proc.stdout.on('data', (d) => {
        const text = d.toString()
        output += text
        event.sender.send('feature-writer-output', text)
      })
      proc.stderr.on('data', (d) => {
        const text = d.toString()
        output += text
        event.sender.send('feature-writer-output', text)
      })
      proc.on('close', (code) => {
        resolve({ success: code === 0, output })
      })
    })
  })

  ipcMain.handle('feature-writer-sync-s3', (event, { bucketUrl }) => {
    return new Promise((resolve) => {
      const featuresDir = path.join(FEATURE_WRITER_DIR, 'features')
      const { S3_PREFIX } = getS3Config()
      const target = bucketUrl || S3_PREFIX
      const proc = spawn('aws', [
        's3', '--endpoint-url', LOCALSTACK_URL,
        'sync', featuresDir, target,
      ], { env: process.env })
      let output = ''
      proc.stdout.on('data', (d) => {
        const text = d.toString()
        output += text
        event.sender.send('feature-writer-output', text)
      })
      proc.stderr.on('data', (d) => {
        const text = d.toString()
        output += text
        event.sender.send('feature-writer-output', text)
      })
      proc.on('close', (code) => {
        resolve({ success: code === 0, output })
      })
    })
  })

  ipcMain.handle('feature-writer-create-sentinels', async (event, { families }) => {
    const selectedFamilies = families && families.length ? families : ['dae', 'bac', 'over']
    const tmpFile = path.join(os.tmpdir(), 'sentinel')
    fs.writeFileSync(tmpFile, '')

    let allOk = true
    for (const family of selectedFamilies) {
      const { S3_SUCCESS_PREFIX } = getS3Config()
      const s3Key = `${S3_SUCCESS_PREFIX}/feature_family=${family}/sentinel`
      event.sender.send('feature-writer-output', `Creating sentinel: ${s3Key}\n`)
      try {
        execSync(
          `aws s3 --endpoint-url ${LOCALSTACK_URL} cp "${tmpFile}" "${s3Key}"`,
          { encoding: 'utf-8' }
        )
        event.sender.send('feature-writer-output', `  OK\n`)
      } catch (e) {
        event.sender.send('feature-writer-output', `  ERROR: ${e.message}\n`)
        allOk = false
      }
    }
    fs.unlinkSync(tmpFile)
    return { success: allOk }
  })

  ipcMain.handle('feature-writer-create-bucket', (event) => {
    return new Promise((resolve) => {
      const proc = spawn('aws', [
        `--endpoint-url=${LOCALSTACK_URL}`,
        's3', 'mb', getS3Config().S3_BUCKET,
      ], { env: process.env })
      let output = ''
      proc.stdout.on('data', (d) => {
        const text = d.toString()
        output += text
        event.sender.send('feature-writer-output', text)
      })
      proc.stderr.on('data', (d) => {
        const text = d.toString()
        output += text
        event.sender.send('feature-writer-output', text)
      })
      proc.on('close', (code) => {
        resolve({ success: code === 0, output })
      })
    })
  })
}

module.exports = { register }
