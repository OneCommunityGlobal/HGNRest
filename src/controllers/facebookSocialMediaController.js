const fetch = require('node-fetch');
const cheerio = require('cheerio');
const facebook_url = "https://graph.facebook.com/";

const app_id = "";
const app_secret = "";

function extractTextAndImgUrl(htmlString) {
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
  
  const getFacebookAccessToken =  async() =>{
    const response = await fetch("https://graph.facebook.com/oauth/access_token?client_id=${app_id}&client_secret=${app_secret}&grant_type=client_credentials");
    const data: {access_token: string} = await response.json();
    if(!response.ok){
      throw new Error ("App access token failed");
    }
    return data.access_token

  };