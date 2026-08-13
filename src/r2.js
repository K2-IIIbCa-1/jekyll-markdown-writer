import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function requiredConfig(config) {
  const missing = [];

  if (!config.accountId) missing.push('R2_ACCOUNT_ID');
  if (!config.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!config.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!config.bucket) missing.push('R2_BUCKET');
  if (!config.endpoint) missing.push('R2_ENDPOINT 또는 jurisdiction에 맞는 R2_ACCOUNT_ID');

  if (missing.length) {
    throw new Error(`R2 설정이 부족합니다: ${missing.join(', ')}`);
  }
}

function client(config) {
  requiredConfig(config);

  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export async function objectExists(config, key) {
  try {
    await client(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

export async function uploadObject(config, { key, body, contentType }) {
  await client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable'
    })
  );

  return {
    key,
    url: `${config.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`
  };
}
