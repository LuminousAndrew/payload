import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { GraphQLClient } from 'graphql-request';
import { promisify } from 'util';
import getConfig from '../../config/load';
import { email, password } from '../../mongoose/testCredentials';

const stat = promisify(fs.stat);

require('isomorphic-fetch');

const config = getConfig();
const api = `${config.serverURL}${config.routes.api}`;

let client;
let token;
let headers;

describe('Collections - Uploads', () => {
  beforeAll(async (done) => {
    const response = await fetch(`${api}/admins/login`, {
      body: JSON.stringify({
        email,
        password,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'post',
    });

    const data = await response.json();

    ({ token } = data);
    headers = {
      Authorization: `JWT ${token}`,
    };

    done();
  });

  describe('REST', () => {
    const mediaDir = path.join(__dirname, '../../../demo', 'media');
    beforeAll(async () => {
      // Clear demo/media directory
      const mediaDirExists = await fileExists(mediaDir);
      if (!mediaDirExists) return;
      fs.readdir(mediaDir, (err, files) => {
        if (err) throw err;

        // eslint-disable-next-line no-restricted-syntax
        for (const file of files) {
          fs.unlink(path.join(mediaDir, file), (unlinkErr) => {
            if (unlinkErr) throw unlinkErr;
          });
        }
      });
    });

    describe('create', () => {
      it('creates', async () => {
        const formData = new FormData();
        formData.append(
          'file',
          fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/image.png')),
        );
        formData.append('alt', 'test media');
        formData.append('locale', 'en');
        const response = await fetch(`${api}/media`, {
          body: formData as unknown as BodyInit,
          headers,
          method: 'post',
        });

        const data = await response.json();

        expect(response.status).toBe(201);

        // Check for files
        expect(await fileExists(path.join(mediaDir, 'image.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'image-16x16.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'image-320x240.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'image-640x480.png'))).toBe(true);

        // Check api response
        expect(data).toMatchObject({
          doc: {
            alt: 'test media',
            filename: 'image.png',
            mimeType: 'image/png',
            sizes: {
              icon: {
                filename: 'image-16x16.png',
                width: 16,
                height: 16,
              },
              mobile: {
                filename: 'image-320x240.png',
                width: 320,
                height: 240,
              },
              tablet: {
                filename: 'image-640x480.png',
                width: 640,
                height: 480,
              },
            },

            // We have a hook to check if upload sizes
            // are properly bound to the Payload `req`.
            // This field should be automatically set
            // if they are found.
            foundUploadSizes: true,
          },
        });
      });

      it('creates images that do not require all sizes', async () => {
        const formData = new FormData();
        formData.append(
          'file',
          fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/small.png')),
        );
        formData.append('alt', 'test media');
        formData.append('locale', 'en');
        const response = await fetch(`${api}/media`, {
          body: formData as unknown as BodyInit,
          headers,
          method: 'post',
        });

        const data = await response.json();

        expect(response.status).toBe(201);

        expect(await fileExists(path.join(mediaDir, 'small.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'small-16x16.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'small-320x240.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'small-640x480.png'))).toBe(false);

        // Check api response
        expect(data).toMatchObject({
          doc: {
            alt: 'test media',
            filename: 'small.png',
            mimeType: 'image/png',
            sizes: {
              icon: {
                filename: 'small-16x16.png',
                width: 16,
                height: 16,
              },
            },

            // We have a hook to check if upload sizes
            // are properly bound to the Payload `req`.
            // This field should be automatically set
            // if they are found.
            foundUploadSizes: true,
          },
        });
      });

      it('creates media without storing a file', async () => {
        const formData = new FormData();
        formData.append(
          'file',
          fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/image.png')),
        );
        formData.append('alt', 'test media');
        formData.append('locale', 'en');

        const response = await fetch(`${api}/unstored-media`, {
          body: formData as unknown as BodyInit,
          headers,
          method: 'post',
        });

        const data = await response.json();

        expect(response.status).toBe(201);

        // Check for files
        expect(await !fileExists(path.join(mediaDir, 'image.png'))).toBe(false);
        expect(await !fileExists(path.join(mediaDir, 'image-640x480.png'))).toBe(false);

        // Check api response
        expect(data).toMatchObject({
          doc: {
            alt: 'test media',
            filename: 'image.png',
            mimeType: 'image/png',
            sizes: {
              tablet: {
                filename: 'image-640x480.png',
                width: 640,
                height: 480,
              },
            },
          },
        });
      });

      it('creates with same name', async () => {
        const formData = new FormData();
        formData.append(
          'file',
          fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/samename.png')),
        );
        formData.append('alt', 'test media');
        formData.append('locale', 'en');

        const firstResponse = await fetch(`${api}/media`, {
          body: formData as unknown as BodyInit,
          headers,
          method: 'post',
        });

        expect(firstResponse.status).toBe(201);

        const sameForm = new FormData();
        sameForm.append(
          'file',
          fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/samename.png')),
        );
        sameForm.append('alt', 'test media');
        sameForm.append('locale', 'en');

        const response = await fetch(`${api}/media`, {
          body: sameForm as unknown as BodyInit,
          headers,
          method: 'post',
        });

        expect(response.status).toBe(201);
        const data = await response.json();

        // Check for files
        expect(await fileExists(path.join(mediaDir, 'samename-1.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'samename-1-16x16.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'samename-1-320x240.png'))).toBe(true);
        expect(await fileExists(path.join(mediaDir, 'samename-1-640x480.png'))).toBe(true);

        expect(data).toMatchObject({
          doc: {
            alt: 'test media',
            filename: 'samename-1.png',
            mimeType: 'image/png',
            sizes: {
              icon: {
                filename: 'samename-1-16x16.png',
                width: 16,
                height: 16,
              },
              mobile: {
                filename: 'samename-1-320x240.png',
                width: 320,
                height: 240,
              },
              tablet: {
                filename: 'samename-1-640x480.png',
                width: 640,
                height: 480,
              },
            },
          },
        });
      });
    });

    it('update', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/update.png')),
      );
      formData.append('alt', 'test media');
      formData.append('locale', 'en');

      const response = await fetch(`${api}/media`, {
        body: formData as unknown as BodyInit,
        headers,
        method: 'post',
      });

      const data = await response.json();

      expect(response.status).toBe(201);

      const updateFormData = new FormData();
      const newAlt = 'my new alt';

      updateFormData.append('filename', data.doc.filename);
      updateFormData.append('alt', newAlt);
      const updateResponse = await fetch(`${api}/media/${data.doc.id}`, {
        body: updateFormData as unknown as BodyInit,
        headers,
        method: 'put',
      });


      const updateResponseData = await updateResponse.json();
      expect(updateResponse.status).toBe(200);

      // Check that files weren't affected
      expect(await fileExists(path.join(mediaDir, 'update.png'))).toBe(true);
      expect(await fileExists(path.join(mediaDir, 'update-16x16.png'))).toBe(true);
      expect(await fileExists(path.join(mediaDir, 'update-320x240.png'))).toBe(true);
      expect(await fileExists(path.join(mediaDir, 'update-640x480.png'))).toBe(true);

      // Check api response
      expect(updateResponseData).toMatchObject({
        doc: {
          alt: newAlt,
          filename: 'update.png',
          mimeType: 'image/png',
          sizes: {
            icon: {
              filename: 'update-16x16.png',
              width: 16,
              height: 16,
            },
            mobile: {
              filename: 'update-320x240.png',
              width: 320,
              height: 240,
            },
            tablet: {
              filename: 'update-640x480.png',
              width: 640,
              height: 480,
            },
            maintainedAspectRatio: {},
          },
        },
      });
    });

    it('delete', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/delete.png')),
      );
      formData.append('alt', 'test media');
      formData.append('locale', 'en');

      const createResponse = await fetch(`${api}/media`, {
        body: formData as unknown as BodyInit,
        headers,
        method: 'post',
      });

      const createData = await createResponse.json();
      expect(createResponse.status).toBe(201);
      const docId = createData.doc.id;

      const response = await fetch(`${api}/media/${docId}`, {
        headers,
        method: 'delete',
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.id).toBe(docId);

      const imageExists = await fileExists(path.join(mediaDir, 'delete.png'));
      expect(imageExists).toBe(false);
    });
  });

  describe('GraphQL', () => {
    // graphql cannot submit formData to create files, we only need to test getting relationship data on upload fields
    let media;
    let image;
    const alt = 'alt text';
    beforeAll(async (done) => {
      client = new GraphQLClient(`${api}${config.routes.graphQL}`, {
        headers: { Authorization: `JWT ${token}` },
      });

      // create media using REST
      const formData = new FormData();
      formData.append(
        'file',
        fs.createReadStream(path.join(__dirname, '../../..', 'tests/api/assets/image.png')),
      );
      formData.append('alt', alt);
      formData.append('locale', 'en');
      const mediaResponse = await fetch(`${api}/media`, {
        body: formData as unknown as BodyInit,
        headers,
        method: 'post',
      });
      const mediaData = await mediaResponse.json();
      media = mediaData.doc;

      // create image that relates to media
      headers['Content-Type'] = 'application/json';
      const imageResponse = await fetch(`${api}/images`, {
        body: JSON.stringify({
          upload: media.id,
        }),
        headers,
        method: 'post',
      });
      const data = await imageResponse.json();
      image = data.doc;

      done();
    });

    it('should query uploads relationship fields', async () => {
      // language=graphQL
      const query = `query {
          Image(id: "${image.id}") {
            id
            upload {
              alt
            }
          }
        }`;

      const response = await client.request(query);
      expect(response.Image.upload.alt).toStrictEqual(alt);
    });
  });
});

async function fileExists(fileName: string): Promise<boolean> {
  try {
    await stat(fileName);
    return true;
  } catch (err) {
    return false;
  }
}
