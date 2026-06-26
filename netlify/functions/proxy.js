exports.handler = async function(event) {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxeLyxLK1I9wc022j5JU6pjrd9G360lC9Sd1jCWm5Plkh0qy2u99jO8b8D-RyjgRkMORw/exec';

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const isPost = event.httpMethod === 'POST';
    const qs = event.rawQuery ? '?' + event.rawQuery : '';
    
    const fetchOptions = {
      method: isPost ? 'POST' : 'GET',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    };
    
    if (isPost && event.body) {
      fetchOptions.body = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;
    }

    const response = await fetch(SCRIPT_URL + qs, fetchOptions);
    const data = await response.text();

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: data
    };
  } catch(err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
