const fetch = require('node-fetch');
const cheerio = require('cheerio');
const axios =  require("axios");
const FormData = require('form-data');
const fs = require('fs');

const facebookController = function(){

  async function extractTextAndImgUrl(htmlString) {
    const $ = cheerio.load(htmlString);
    const textContent = $('body').text().replace(/\+/g, '').trim();
    const urlSrcs = [];
    const base64Srcs = [];
 
    $('img').each((i, img) => {
      const src = $(img).attr('src');
      if (src) {
        if (src.startsWith('data:image')) {
          base64Srcs.push(src);
        } else {
          urlSrcs.push(src);
        }
      }
    });
      return { textContent, urlSrcs, base64Srcs };
    }


    async function downloadImage(url) {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: response.headers.get('content-type'),
      };
    }

    async function getPagesManagedByUser(authToken) {
      try {
        const response = await axios.get('https://graph.facebook.com/v15.0/me/accounts', {
          headers: {
            Authorization: `Bearer ${authToken}`,  
          },
        });
  
        const pages = response.data.data;  
        const pageDetails = pages.map(page => {
          return {
            id: page.id,  
            access_token: page.access_token  
          };
        });
  
        return pageDetails;  
      } catch (error) {
        console.error('[Backend] Error fetching pages:', error);
        throw error;
      }
    }


    async function postToPageFeed(pageId, pageAccessToken, message) {
      try {
        const response = await axios.post(
          `https://graph.facebook.com/v15.0/${pageId}/feed`,
          {
            message: message,  
          },
          {
            headers: {
              Authorization: `Bearer ${pageAccessToken}`,  
            },
          }
        );
        return response.data;
      } catch (error) {
        console.error('Error posting to page feed:', error);
        throw error;  
      }
    }

    async function postImgToPageFeed(pageId, pageAccessToken, message, base64Srcs) {
      const requestUrl = `https://graph.facebook.com/v15.0/${pageId}/photos`;
      let form = new FormData();
      form.append('message', message);
  
      if (base64Srcs.length > 0) {
        base64Srcs.forEach(base64Image => {
          const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          form.append('source', buffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg',
          });
        });
      }
  
      try {
        const response = await axios.post(requestUrl, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${pageAccessToken}`,
          },
        });
  
        return response.data;
      } catch (error) {
        console.error('Error posting to page feed:', error);
        throw error;
      }
    }



  async function createFbPost(req,res){
    console.log('calling backend')
    
    const { textContent, urlSrcs, base64Srcs } = await extractTextAndImgUrl(req.body.emailContent);
    console.log("email content",req.body.accessToken);
    const authToken = req.body.accessToken;
    const pages = await getPagesManagedByUser(authToken);
    if (pages.length === 0) {
      return res.status(400).json({ error: 'No pages found for this user' });
    }
    const page = pages[0];  // In this case, we are posting to the first page the user manages
      const pageId = page.id;
      const pageAccessToken = page.access_token;
      console.log("pageId",pageId);
      console.log("pageAccessToken",pageAccessToken)
      let postResponse;
    try {
       if (base64Srcs.length > 0) { 
        const postResponse = await postImgToPageFeed(pageId, pageAccessToken, textContent, base64Srcs); 
      }
       else {
      const postResponse = await postToPageFeed(pageId, pageAccessToken, textContent);
      }
      res.status(200).json(postResponse);  
      console.log("postResponse",postResponse);
    } catch (error) {
      console.error('[Backend] Error creating Facebook post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }

  }
  return {createFbPost}

}

module.exports = facebookController

