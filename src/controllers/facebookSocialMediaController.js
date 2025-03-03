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
    
    /**const getFacebookAccessToken =  async() =>{
      const response = await fetch("https://graph.facebook.com/oauth/access_token?client_id=${app_id}&client_secret=${app_secret}&grant_type=client_credentials");
      const data: {access_token: string} = await response.json();
      if(!response.ok){
        throw new Error ("App access token failed");
      }
      return data.access_token

    };**/

  async function createFbPost(req,res){
    console.log('calling backend')
    const authToken ="EAASZBdxJRmpMBO9p6FpMaTeW1Xwi3R5Ww6Lmt5Tmg2zhjXmotA2IZBzmKDxdpRJLOBy1ZA2ULWZBKzUt3aE1WDunUOazJ0GSeMdySzLZAnB2LwaAhIizS4aB6gj2yZCazR8lXKn2OWkbAtlhRiOUiPgSplKkZCOtryduO7pGMxjWoI4YZC7vZBLsVJFQLySbPIcZAT";
    const { textContent, urlSrcs, base64Srcs } = await extractTextAndImgUrl(req.body.EmailContent);
    let requestUrl = "https://graph.facebook.com/v15.0/515563784975867/feed"; // Default is text-only post


    if (urlSrcs.length > 0 || base64Srcs.length > 0) {
      requestUrl = "https://graph.facebook.com/v15.0/515563784975867/photos";
    }
    let form = new FormData();
    form.append('message', textContent);    

   if (base64Srcs.length > 0) {
      base64Srcs.forEach(base64Image => {
      const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      form.append('source', buffer, {
        filename: 'image.jpg',  // Adjust according to image format
        contentType: 'image/jpeg',  // Adjust according to image format
      });
    });
   }
     try {
        const response = await axios.post(
          requestUrl,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

  
        const statusCode = response.status;
        const responseData = response.data;
  
        // Handling the response
        if (statusCode >= 200 && statusCode < 300) {
          res.status(200).json(responseData);
        } else {
          console.error('[Backend] Error creating Pin: ', responseData.message);
          res.status(statusCode).json({
            message: responseData.message || 'Unexpected error',
          });
        }
      } catch (error) {
        // Catching errors in the try block
        console.error('[Backend] Network or other error: ', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }

  }
  return {createFbPost}

}

module.exports = facebookController

