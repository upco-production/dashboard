exports.handler = async function(event) {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxeLyxLK1I9wc022j5JU6pjrd9G360lC9Sd1jCWm5Plkh0qy2u99jO8b8D-RyjgRkMORw/exec';
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  const qs = event.rawQuery ? '?' + event.rawQuery : '';
  const response = await fetch(SCRIPT_URL + qs, {
    method: event.httpMethod,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: event.body || undefined
  });

  const data = await response.text();
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: data
  };
};
