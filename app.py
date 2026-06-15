from flask import Flask, render_template, jsonify, request
import urllib.request
import xml.etree.ElementTree as ET
import re
import time
from datetime import datetime

app = Flask(__name__)

# In-memory cache for feed data
feed_cache = {
    'data': None,
    'last_fetched': 0
}
CACHE_DURATION = 300  # 5 minutes cache

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', namespaces)
    parsed_updates = []
    
    # Regex to split content by <h3>Tags</h3>
    # e.g., <h3>Feature</h3> <p>...</p> <h3>Resolved</h3> <p>...</p>
    pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=(?:<h3>|$))', re.DOTALL | re.IGNORECASE)
    
    for entry in entries:
        title_date = entry.find('atom:title', namespaces)
        title_date = title_date.text.strip() if title_date is not None else "Unknown Date"
        
        updated_elem = entry.find('atom:updated', namespaces)
        updated_str = updated_elem.text.strip() if updated_elem is not None else ""
        
        entry_id_elem = entry.find('atom:id', namespaces)
        entry_id = entry_id_elem.text.strip() if entry_id_elem is not None else title_date
        
        link_elem = entry.find('atom:link', namespaces)
        link_url = "https://cloud.google.com/bigquery/docs/release-notes"
        if link_elem is not None and 'href' in link_elem.attrib:
            link_url = link_elem.attrib['href']
            
        content_elem = entry.find('atom:content', namespaces)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Parse updates within entry
        matches = pattern.findall(content_html)
        if not matches:
            # Fallback if no <h3> tags
            parsed_updates.append({
                'id': f"{entry_id}_0",
                'date': title_date,
                'updated': updated_str,
                'type': 'Update',
                'content': content_html.strip(),
                'link': link_url
            })
        else:
            for idx, (utype, ucontent) in enumerate(matches):
                parsed_updates.append({
                    'id': f"{entry_id}_{idx}",
                    'date': title_date,
                    'updated': updated_str,
                    'type': utype.strip(),
                    'content': ucontent.strip(),
                    'link': link_url
                })
                
    return parsed_updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or not feed_cache['data'] or (now - feed_cache['last_fetched'] > CACHE_DURATION):
        try:
            updates = fetch_and_parse_feed()
            feed_cache['data'] = updates
            feed_cache['last_fetched'] = now
            return jsonify({
                'success': True,
                'source': 'network',
                'last_fetched': datetime.fromtimestamp(now).strftime('%Y-%m-%d %H:%M:%S'),
                'releases': updates
            })
        except Exception as e:
            # If network fetch fails but we have cached data, fall back to cache
            if feed_cache['data']:
                return jsonify({
                    'success': True,
                    'source': 'cache_fallback_error',
                    'error': str(e),
                    'last_fetched': datetime.fromtimestamp(feed_cache['last_fetched']).strftime('%Y-%m-%d %H:%M:%S'),
                    'releases': feed_cache['data']
                })
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
            
    return jsonify({
        'success': True,
        'source': 'cache',
        'last_fetched': datetime.fromtimestamp(feed_cache['last_fetched']).strftime('%Y-%m-%d %H:%M:%S'),
        'releases': feed_cache['data']
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
