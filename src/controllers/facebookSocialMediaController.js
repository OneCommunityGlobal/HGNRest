const fetch = require('node-fetch');
const cheerio = require('cheerio');
const axios =  require("axios");
const facebookController = function(){
  async function extractText(htmlString){
    const $ = cheerio.load(htmlString);
    const textContent = $('body').text().replace(/\+/g, '').trim();
    console.log("textContent", textContent);
    return textContent;
    }
  async function extractTextAndImgUrl(htmlString) {
      const $ = cheerio.load(htmlString);
      //const { data:htmlString } = await axios.get(htmlString);
      //const parser = new DOMParser();
      //const doc = parser.parseFromString(htmlString, 'text/html');

      const textContent = $('body').text().replace(/\+/g, '').trim();
      //const textContent = doc.body.textContent.replace(/\+/g, '').trim();
      const urlSrcs = [];
      const base64Srcs = [];
    
      //const images = doc.querySelectorAll('img');
      //images.forEach(img => {
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        //const src = img.getAttribute('src');
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
    /**return res.status(200).json({
      message: 'send from the backend'
    })**/
    const requestUrl = "https://graph.facebook.com/515563784975867/feed";
    const authToken ="EAASZBdxJRmpMBO9p6FpMaTeW1Xwi3R5Ww6Lmt5Tmg2zhjXmotA2IZBzmKDxdpRJLOBy1ZA2ULWZBKzUt3aE1WDunUOazJ0GSeMdySzLZAnB2LwaAhIizS4aB6gj2yZCazR8lXKn2OWkbAtlhRiOUiPgSplKkZCOtryduO7pGMxjWoI4YZC7vZBLsVJFQLySbPIcZAT";
    //const { textContent, urlSrcs, base64Srcs } = extractTextAndImgUrl(req.body.EmailContent);
    const textContent = await extractText(req.body.EmailContent);
    console.log("textin func", textContent);

    /**if (urlSrcs.length === 0 && base64Srcs.length === 0) {
      return res.status(400).json({ message: 'No image found in the email content' });
    }

    if (urlSrcs.length > 0 && base64Srcs.length > 0) {
      return res.status(400).json({
        message:
          'Both URL and base64 images found in the email content. Please choose only one type.',
      });
    }**/

    /**try {
      const baseRequestBody = {
        message: textContent,
      };
      console.log("baseRequest", baseRequestBody);**/

      //let mediaSource = {};

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
      }

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
      }**/

      /**const requestBody = JSON.stringify({
        ...baseRequestBody,
        //media_source: mediaSource,
      });
      console.log("requestbody", requestBody);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          Authorization: '${authToken}',
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });


      const statusCode = response.status;
      //const responseData = await response.json();
      let responseData;
      try {
        responseData = await response.json();
        
      } catch (error) {
        console.error('Error parsing JSON:', error);
        return res.status(500).json({ error: 'Failed to parse Facebook response' });
      }

      if (statusCode >= 200 && statusCode < 300) {
        res.status(200).json(responseData);
      } else {
        console.error('[Backend] Error creating Pin: ', responseData.message);
        res.status(statusCode).json({
          message: responseData.message || 'Unexpected error',
        });
      }
    } catch (error) {
      console.error('[Backend] Network or other error: ', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }**/
      try {
        const baseRequestBody = {
          message: textContent,
        };
  
        console.log("baserequestbody", baseRequestBody);
  
        // Sending request using axios
        const response = await axios.post(requestUrl, baseRequestBody, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });
  
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

