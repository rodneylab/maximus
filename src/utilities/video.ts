import axios from 'axios';

interface VideoUploadProps {
  readonly captionsUrl: string;
  readonly videoUrl: string;
}

export const upload = (props: VideoUploadProps) => {
  const result = (async () => {
    const { captionsUrl, videoUrl } = props;
    try {
      const authorisationToken = Buffer.from(
        `${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`,
        'utf-8',
      ).toString('base64');
      const data = {
        input: [
          { url: videoUrl },
          {
            url: captionsUrl,
            type: 'text',
            text_type: 'subtitles',
            closed_captions: true,
            language_code: 'en-GB',
            name: 'English',
          },
        ],
        playback_policy: 'public',
        mp4_support: 'standard',
      };
      const response = await axios({
        url: 'https://api.mux.com/video/v1/assets',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authorisationToken}`,
        },
        data,
      });

      console.log('mux response:', response);
      const { data: responseData } = response.data;
      const playbackId = responseData.playback_ids[0].id;
      const { id: videoId } = responseData;

      return { successful: true, playbackId, videoId };
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
