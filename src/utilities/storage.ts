import {
  AbortMultipartUploadCommand,
  CompletedPart,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { HttpRequest as IHttpRequest } from '@aws-sdk/types';
import { createRequest } from '@aws-sdk/util-create-request';
import { formatUrl } from '@aws-sdk/util-format-url';
import axios from 'axios';
import cuid from 'cuid';
import fs from 'fs';
import { isProduction } from './utilities';

const BUCKET = process.env.BACKBLAZE_BUCKET_NAME;

type BackblazeAuthoriseAccountResponse = {
  successful: boolean;
  absoluteMinimumPartSize?: number;
  authorisationToken?: string;
  apiUrl?: string;
  downloadUrl?: string;
  recommendedPartSize?: number;
  s3ApiUrl?: string;
};

const abortMultipartUpload = async ({
  client,
  key,
  uploadId,
}: {
  client: S3;
  key: string;
  uploadId: string;
}) => {
  try {
    await client.send(
      new AbortMultipartUploadCommand({
        Key: key,
        Bucket: BUCKET,
        UploadId: uploadId,
      }),
    );
  } catch (error) {
    console.error('Error aborting multipart upload: ', error);
  }
};

const authoriseAccount = async (): Promise<BackblazeAuthoriseAccountResponse> => {
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
      const response = await axios.request<{
        absoluteMinimumPartSize: number;
        authorizationToken: string;
        apiUrl: string;
        downloadUrl: string;
        recommendedPartSize: number;
        s3ApiUrl: string;
      }>({
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

const completeMultipartUpload = async ({
  parts,
  client,
  key,
  uploadId,
}: {
  client: S3;
  key: string;
  parts: CompletedPart[];
  uploadId: string;
}): Promise<{ successful: boolean; id?: string | undefined }> => {
  try {
    const { VersionId: id } = await client.send(
      new CompleteMultipartUploadCommand({
        Key: key,
        Bucket: BUCKET,
        MultipartUpload: { Parts: parts },
        UploadId: uploadId,
      }),
    );
    if (id) {
      return { successful: true, id };
    }
  } catch (error) {
    console.error('Error in completing multipart upload: ', error);
  }
  return { successful: false };
};

const getRegion = (s3ApiUrl: string) => s3ApiUrl.split('.')[1];

const getS3Client = ({ s3ApiUrl }: { s3ApiUrl: string }) => {
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
  return S3Client;
};

const generatePresignedUrls = async ({ key, s3ApiUrl }: { key: string; s3ApiUrl: string }) => {
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

// const getObjectId = async ({ client, key }: { client: S3; key: string }): Promise<string> => {
//   try {
//     const { Versions: versions } = await client.send(
//       new ListObjectVersionsCommand({
//         KeyMarker: key,
//         Bucket: BUCKET,
//         MaxKeys: 1,
//       }),
//     );
//     if (versions) {
//       const latestVersion = versions.find((element) => element.IsLatest);
//       return latestVersion?.VersionId || '';
//     }
//   } catch (error) {
//     console.error('Error aborting multipart upload: ', error);
//   }
//   return '';
// };

const initiateMultipartUpload = async ({
  client,
  key,
}: {
  client: S3;
  key: string;
}): Promise<string | undefined> => {
  const { UploadId: uploadId } = await client.send(
    new CreateMultipartUploadCommand({ Key: key, Bucket: BUCKET }),
  );
  return uploadId;
};

const generatePresignedPartUrls = async ({
  client,
  key,
  uploadId,
  partCount,
}: {
  client: S3;
  key: string;
  uploadId: string;
  partCount: number;
}) => {
  const signer = new S3RequestPresigner({ ...client.config });
  const createRequestPromises = [];

  for (let index = 0; index < partCount; index += 1) {
    createRequestPromises.push(
      createRequest(
        client,
        new UploadPartCommand({
          Key: key,
          Bucket: BUCKET,
          UploadId: uploadId,
          PartNumber: index + 1,
        }),
      ),
    );
  }

  const uploadPartRequestResults = await Promise.all(createRequestPromises);

  const presignPromises: Promise<IHttpRequest>[] = [];
  uploadPartRequestResults.forEach((element) => presignPromises.push(signer.presign(element)));
  const presignPromiseResults = await Promise.all(presignPromises);
  return presignPromiseResults.map((element) => formatUrl(element));
};

export const remove = async ({ key, id }: { key: string; id?: string }) => {
  const { s3ApiUrl } = await authoriseAccount();
  if (s3ApiUrl) {
    const client = getS3Client({ s3ApiUrl });

    /* If versioning is switched on for the bucket, this will only hide the file and create a delete
     * marker.  Set lifecyle rules on the bucket to delete hidden files after one day, for example.
     */
    const deleteObject = async () => {
      const { DeleteMarker: marker, VersionId: deleteMarkerVersionId } = await client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: key,
          VersionId: id,
        }),
      );
      return { marker, deleteMarkerVersionId };
    };

    await setTimeout(deleteObject, 1000); // delay one second to avoid processing errors
    return { successful: true };
  }
  return { successful: false };
};

const singlePartUpload = async ({
  contentType,
  key,
  path,
  s3ApiUrl,
}: {
  contentType: string;
  key: string;
  path: string;
  s3ApiUrl: string;
}): Promise<{
  successful: boolean;
  readSignedUrl?: string;
  message?: string;
  id?: string;
}> => {
  try {
    const { readSignedUrl, writeSignedUrl } = await generatePresignedUrls({ key, s3ApiUrl });
    const data = await fs.readFileSync(path);
    const result = await axios({
      url: writeSignedUrl,
      method: 'PUT',
      data,
      headers: {
        'Content-Type': contentType,
      },
    });
    const id = result.headers['x-amz-version-id'];
    return { successful: true, readSignedUrl, id };
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
};

const uploadParts = async ({
  contentType,
  partSize = 10_000_000,
  path,
  uploadUrls,
}: {
  contentType: string;
  partSize: number;
  path: string;
  uploadUrls: string[];
}): Promise<CompletedPart[]> => {
  const data = await fs.readFileSync(path);
  const lastIndex = uploadUrls.length - 1;

  const uploadPromises = uploadUrls.map((element, index) =>
    axios({
      url: element,
      method: 'PUT',
      data:
        index !== lastIndex
          ? data.slice(index * partSize, (index + 1) * partSize)
          : data.slice(index * partSize),
      headers: {
        'Content-Type': contentType,
      },
    }),
  );
  const uploadResults = await Promise.all(uploadPromises);
  return uploadResults.map((element, index) => ({
    ETag: element.headers.etag,
    PartNumber: index + 1,
  }));
};

export const upload = async ({
  contentType,
  key,
  path,
  size,
}: {
  contentType: string;
  key: string;
  path: string;
  size: number;
}): Promise<{
  successful: boolean;
  readSignedUrl?: string;
  message?: string;
  id?: string;
}> => {
  const result = (async () => {
    let client;
    let uploadId;
    try {
      const { absoluteMinimumPartSize, recommendedPartSize, s3ApiUrl } = await authoriseAccount();
      if (s3ApiUrl) {
        client = getS3Client({ s3ApiUrl });
        if (absoluteMinimumPartSize && size > absoluteMinimumPartSize) {
          uploadId = await initiateMultipartUpload({ client, key });
          if (recommendedPartSize) {
            const partSize =
              size < recommendedPartSize ? absoluteMinimumPartSize : recommendedPartSize;
            const partCount = Math.ceil(size / partSize);
            if (uploadId) {
              const uploadUrls = await generatePresignedPartUrls({
                client,
                key,
                uploadId,
                partCount,
              });
              const parts = await uploadParts({ contentType, partSize, path, uploadUrls });
              const { id } = await completeMultipartUpload({ parts, client, key, uploadId });
              const { readSignedUrl } = await generatePresignedUrls({ key, s3ApiUrl });
              return { successful: true, readSignedUrl, id };
            }
          }
        } else {
          const singlePartUploadResult = await singlePartUpload({
            contentType,
            key,
            path,
            s3ApiUrl,
          });
          return { ...singlePartUploadResult };
        }
      }
      return { successful: false };
    } catch (error) {
      let message;
      if (client && uploadId) {
        abortMultipartUpload({ client, key, uploadId });
      }
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
