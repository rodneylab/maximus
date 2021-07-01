import axios from 'axios';
import { isProduction } from './utilities';

export const authoriseAccount = async () => {
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

      const { authorizationToken, apiUrl, downloadUrl, s3ApiUrl } = response.data;
      return { successful: true, authorizationToken, apiUrl, downloadUrl, s3ApiUrl };
    } catch (error) {
      let message;
      if (error.response) {
        message = `Telegram server responded with non 2xx code: ${error.response.data}`;
      } else if (error.request) {
        message = `No Telegram response received: ${error.request}`;
      } else {
        message = `Error setting up telegram response: ${error.message}`;
      }
      return { successful: false, message };
    }
  })();
  return result;
};
