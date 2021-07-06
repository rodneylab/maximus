import { GetObjectCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { createRequest } from '@aws-sdk/util-create-request';
import { formatUrl } from '@aws-sdk/util-format-url';
import axios from 'axios';
import cuid from 'cuid';
import fs from 'fs';
import { isProduction } from './utilities';

const authoriseAccount = async () => {
  if (!isProduction) {
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env._proxy;
  }
  const result = (async () => {
    try {
      const authorisationToken = Buffer.from(
        `${process.env.BACKBLAZE_ACCOUNT_ID}:${process.env.BACKBLAZE_ACCOUNT_AUTH_TOKEN}`,
        'utf-8',
      ).toString('base64');
      const response = await axios({
        url: 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
        method: 'GET',
        headers: {
          Authorization: `Basic ${authorisationToken}`,
        },
      });

      const {
        absoluteMinimumPartSize,
        authorizationToken,
        apiUrl,
        downloadUrl,
        recommendedPartSize,
        s3ApiUrl,
      } = response.data;
      return {
        successful: true,
        absoluteMinimumPartSize,
        authorizationToken,
        apiUrl,
        downloadUrl,
        recommendedPartSize,
        s3ApiUrl,
      };
    } catch (error) {
      let message;
      if (error.response) {
        message = `Storage server responded with non 2xx code: ${error.response.data}`;
      } else if (error.request) {
        message = `No storage response received: ${error.request}`;
      } else {
        message = `Error setting up storage response: ${error.message}`;
      }
      return { successful: false, message };
    }
  })();
  return result;
};

const getRegion = (s3ApiUrl: string) => s3ApiUrl.split('.')[1];

interface GeneratePresignedUrlsProps {
  readonly key: string;
  readonly s3ApiUrl: string;
}

const generatePresignedUrls = async (props: GeneratePresignedUrlsProps) => {
  const { key, s3ApiUrl } = props;
  const Bucket = process.env.BACKBLAZE_BUCKET_NAME;
  const Key = key;
  const credentials = {
    accessKeyId: process.env.BACKBLAZE_ACCOUNT_ID as string,
    secretAccessKey: process.env.BACKBLAZE_ACCOUNT_AUTH_TOKEN as string,
    sessionToken: `session-${cuid()}`,
  };

  const S3Client = new S3({
    endpoint: s3ApiUrl,
    region: getRegion(s3ApiUrl),
    credentials,
  });

  const signer = new S3RequestPresigner({ ...S3Client.config });
  const readRequest = await createRequest(S3Client, new GetObjectCommand({ Key, Bucket }));
  const readSignedUrl = formatUrl(await signer.presign(readRequest));
  const writeRequest = await createRequest(S3Client, new PutObjectCommand({ Key, Bucket }));
  const writeSignedUrl = formatUrl(await signer.presign(writeRequest));
  return { readSignedUrl, writeSignedUrl };
};

const initiateMultipartUpload = () => {};

interface S3CompatibleUploadProps {
  readonly contentType: string;
  readonly key: string;
  readonly path: string;
  readonly size?: number;
}

export const upload = async (props: S3CompatibleUploadProps) => {
  const { contentType, key, path } = props;
  const result = (async () => {
    try {
      const { s3ApiUrl } = await authoriseAccount();
      const { readSignedUrl, writeSignedUrl } = await generatePresignedUrls({ key, s3ApiUrl });
      const data = await fs.readFileSync(path);
      await axios({
        url: writeSignedUrl,
        method: 'PUT',
        data,
        headers: {
          'Content-Type': contentType,
        },
      });
      return { successful: true, readSignedUrl, writeSignedUrl };
    } catch (error) {
      let message;
      if (error.response) {
        message = `Storage server responded with non 2xx code: ${error.response.data}`;
      } else if (error.request) {
        message = `No storage response received: ${error.request}`;
      } else {
        message = `Error setting up storage response: ${error.message}`;
      }
      return { successful: false, message };
    }
  })();
  return result;
};
