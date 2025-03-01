const fetch = require('node-fetch');
const cheerio = require('cheerio');
const axios =  require("axios");
const FormData = require('form-data');
const fs = require('fs');

const facebookController = function(){
  async function extractText(htmlString){
    const $ = cheerio.load(htmlString);
    const textContent = $('body').text().replace(/\+/g, '').trim();
    //console.log("textContent", textContent);
    return textContent;
    }
  async function extractTextAndImgUrl(htmlString) {
    console.log("htmlstring", htmlString)
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
    console.log("urlSrcs func", urlSrcs);
    //console.log("base64Srcs func", base64Srcs);

    //const textContent = await extractText(req.body.EmailContent);
    console.log("textin func", textContent);
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
    /**return res.status(200).json({
      message: 'send from the backend'
    })**/
    //const requestUrl = "https://graph.facebook.com/515563784975867/feed";
    const requestUrl = "https://graph.facebook.com/v15.0/515563784975867/photos";
    const authToken ="EAASZBdxJRmpMBO9p6FpMaTeW1Xwi3R5Ww6Lmt5Tmg2zhjXmotA2IZBzmKDxdpRJLOBy1ZA2ULWZBKzUt3aE1WDunUOazJ0GSeMdySzLZAnB2LwaAhIizS4aB6gj2yZCazR8lXKn2OWkbAtlhRiOUiPgSplKkZCOtryduO7pGMxjWoI4YZC7vZBLsVJFQLySbPIcZAT";
    const { textContent, urlSrcs, base64Srcs } = await extractTextAndImgUrl(req.body.EmailContent);
    console.log("urlSrcs ", urlSrcs);
    //console.log("base64Srcs", base64Srcs);

    //const textContent = await extractText(req.body.EmailContent);
    console.log("textin", textContent);
    let form = new FormData();
    form.append('message', textContent);

    if (urlSrcs.length === 0 && base64Srcs.length === 0) {
      return res.status(400).json({ message: 'No image found in the email content' });
    }

    if (urlSrcs.length > 0 && base64Srcs.length > 0) {
      return res.status(400).json({
        message:
          'Both URL and base64 images found in the email content. Please choose only one type.',
      });
    }

    

    let mediaSource = {};

    /**if (base64Srcs.length !== 0) {
      mediaSource =
        base64Srcs.length === 1
          ? {
              source_type: 'image_base64',
              content_type: base64Srcs[0].split(';')[0].split(':')[1] || 'image/png',
              data: base64Srcs[0].replace(/^data:image\/\w+;base64,/, ''),
            }
            : {
                source_type: 'multiple_image_base64',
                items: base64Srcs.map((imgSrc) => ({
                  content_type: imgSrc.split(';')[0].split(':')[1] || 'image/png',
                  data: imgSrc.replace(/^data:image\/\w+;base64,/, ''),
                })),
              };
      }**/
     /** 
      if (base64Srcs.length !== 0) {
                mediaSource = base64Srcs.length === 1
                  ? {
                      url: base64Srcs[0],
                    }
                  : {
                      urls: base64Srcs.map((imgSrc) => imgSrc),
                    };
        }*/
                    if (base64Srcs.length > 0) {
                      base64Srcs.forEach(base64Image => {
                        const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                        form.append('source', buffer, {
                          filename: 'image.jpg',  // Adjust according to image format
                          contentType: 'image/jpeg',  // Adjust according to image format
                        });
                      });
                    }

    /** 
      if (urlSrcs.length !== 0) {
        mediaSource =
          urlSrcs.length === 1
            ? {
                source_type: 'image_url',
                url: urlSrcs[0],
              }
            : {
                source_type: 'multiple_image_urls',
                items: urlSrcs.map((url) => ({ url })),
              };
      }*/
      if (urlSrcs.length !== 0) {
          mediaSource = urlSrcs.length === 1
                  ? { url: urlSrcs[0] }
                  : { urls: urlSrcs };
        }
      //console.log('mediaSource', mediaSource);

      
      try {
        const baseRequestBody = {
          message: textContent,
          ...mediaSource,
        };

        
  
        console.log("baserequestbody", baseRequestBody);
        // Sending request using axios
        /** 
        const response = await axios.post(requestUrl, baseRequestBody, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });**/

        console.log("form", form);
        const response = await axios.post(
          `https://graph.facebook.com/v15.0/515563784975867/photos`,
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

