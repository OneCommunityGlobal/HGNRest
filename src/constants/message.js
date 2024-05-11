// export const URL_TO_BLUE_SQUARE_PAGE = 'https://www.onecommunityglobal.org/hands-off-administration-policy'

// // Since the notification banner is blue background, added white color for hyperlink style.
// export const NEW_USER_BLUE_SQUARE_NOTIFICATION_MESSAGE = `
//   <p> Welcome as one of our newest members to the One Community team and family! 
//   Heads up we’ve removed a <a href=${URL_TO_BLUE_SQUARE_PAGE}>“blue square”</a> that 
//   was issued due to not completing your hours and/or summary this past week. The reason we removed 
//   this blue square is because you didn’t have the full week available to complete your volunteer 
//   time with us. </p>
  
//   <p> If you’d like to learn more about this policy and/or blue squares, click here: 
//   <a href=${URL_TO_BLUE_SQUARE_PAGE}> “Blue Square FAQ”</a>  
//   </p>
  
//   <p>Welcome again, we’re glad to have you joining us! </p>

//   <p>With Gratitude,</br>One Community </p>
//   `;

const URL_TO_BLUE_SQUARE_PAGE = 'https://www.onecommunityglobal.org/hands-off-administration-policy';

const NEW_USER_BLUE_SQUARE_NOTIFICATION_MESSAGE = '<p> Welcome as one of our newest members to the One Community team and family! ' +
  'Heads up we’ve removed a <a href="' + URL_TO_BLUE_SQUARE_PAGE + '">“blue square”</a> that ' +
  'was issued due to not completing your hours and/or summary this past week. The reason we removed ' +
  'this blue square is because you didn’t have the full week available to complete your volunteer ' +
  'time with us. </p>' +
  
  '<p> If you’d like to learn more about this policy and/or blue squares, click here: ' +
  '<a href="' + URL_TO_BLUE_SQUARE_PAGE + '"> “Blue Square FAQ”</a> ' +
  '</p>' +
  
  '<p>Welcome again, we’re glad to have you joining us! </p>' +
  
  '<p>With Gratitude,<br/>One Community </p>';

// Exporting variables using CommonJS module pattern
module.exports.URL_TO_BLUE_SQUARE_PAGE = URL_TO_BLUE_SQUARE_PAGE;
module.exports.NEW_USER_BLUE_SQUARE_NOTIFICATION_MESSAGE = NEW_USER_BLUE_SQUARE_NOTIFICATION_MESSAGE;