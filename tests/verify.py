import pathlib, os
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
MOCK='''
window.saved={selector:'[data-testid="ghost"]',enabled:true};
const storageListeners=[], messageListeners=[];
window.chrome={
 storage:{local:{get:async defaults=>({...defaults,...saved}),set:async changes=>{
  const result={}; for(const [k,v] of Object.entries(changes)){result[k]={oldValue:saved[k],newValue:v};saved[k]=v;}
  storageListeners.forEach(fn=>fn(result,'local'));
 }},onChanged:{addListener:fn=>storageListeners.push(fn)}},
 runtime:{id:'quiet-composer-test',onMessage:{addListener:fn=>messageListeners.push(fn)}}
};
window.sendExtension=message=>new Promise(resolve=>messageListeners.forEach(fn=>fn(message,{id:chrome.runtime.id},resolve)));
'''
FIXTURE='''<!doctype html><html><body>
<article data-message-author-role="assistant"><span data-testid="ghost">Transcript text must stay visible</span></article>
<form style="position:relative;margin:100px 30px;width:500px;height:160px">
<div id="editor" contenteditable="true" role="textbox" style="width:500px;height:100px">My own words<span> are here</span></div>
<div data-testid="ghost" style="pointer-events:none;position:absolute;left:12px;top:20px;width:300px;height:30px;color:gray">A suggested reply</div>
<button type="button"><span id="send-label">Send</span></button>
</form></body></html>'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, **({'executable_path':os.environ['QUIET_COMPOSER_BROWSER']} if os.environ.get('QUIET_COMPOSER_BROWSER') else {}))
 page=browser.new_page(viewport={'width':900,'height':600})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(FIXTURE)
 page.add_script_tag(content=MOCK)
 page.add_script_tag(path=str(ROOT/'protocol.js'))
 page.add_style_tag(path=str(ROOT/'content.css'))
 page.add_script_tag(path=str(ROOT/'content.js'))
 page.wait_for_function('getComputedStyle(document.querySelector("form [data-testid=ghost]")).visibility==="hidden"')
 assert page.locator('article span').is_visible()
 page.locator('#editor').fill('My independently written message')
 assert page.locator('#editor').inner_text()=='My independently written message'
 assert page.locator('button').is_visible()
 print('PASS: overlay hidden; transcript, editing, and Send preserved')
 page.evaluate('''() => {const old=document.querySelector('form [data-testid=ghost]'); const fresh=old.cloneNode(true);fresh.removeAttribute('data-quiet-composer-hidden');old.replaceWith(fresh);}''')
 page.wait_for_function('document.querySelector("form [data-testid=ghost]").hasAttribute("data-quiet-composer-hidden")')
 print('PASS: replacement suggestion hidden after rerender')
 page.evaluate('chrome.storage.local.set({enabled:false})')
 page.wait_for_function('getComputedStyle(document.querySelector("form [data-testid=ghost]")).visibility==="visible"')
 print('PASS: disable restores visual overlay')
 for bad in ['body','form','#editor','#editor span','button','#send-label']:
  response=page.evaluate('(s)=>sendExtension({type:"quiet-composer-check",selector:s})',bad)
  assert response['ok'] and response['count']==0,(bad,response)
 response=page.evaluate('sendExtension({type:"quiet-composer-check",selector:"["})')
 assert response['ok'] is False
 print('PASS: broad/editor/control selectors refused; invalid syntax reported')
 assert page.evaluate('sendExtension({type:"quiet-composer-pick"})')['ok']
 r=page.locator('form [data-testid="ghost"]').bounding_box()
 page.mouse.move(r['x']+30,r['y']+10)
 page.mouse.click(r['x']+30,r['y']+10)
 page.wait_for_function('saved.enabled===true && !document.querySelector("[data-quiet-composer-ui]")')
 page.wait_for_function('document.querySelector("form [data-testid=ghost]").hasAttribute("data-quiet-composer-hidden")')
 assert page.evaluate('saved.selector')=='[data-testid=ghost]'
 print('PASS: picker selects pointer-events:none overlay and saves reusable selector')
 page.evaluate('chrome.storage.local.set({selector:"",enabled:false})')
 page.wait_for_function('getComputedStyle(document.querySelector("form [data-testid=ghost]")).visibility==="visible"')
 assert page.evaluate('sendExtension({type:"quiet-composer-pick"})')['ok']
 page.keyboard.press('Escape')
 assert page.locator('[data-quiet-composer-ui]').count()==0
 print('PASS: clear restores overlay; Escape cancels picker')
 page.evaluate('chrome.storage.local.set({selector:"[data-testid=ghost]",enabled:true})')
 page.wait_for_function('document.querySelector("form [data-testid=ghost]").hasAttribute("data-quiet-composer-hidden")')
 page.evaluate('document.querySelector("form [data-testid=ghost]").append(document.createElement("textarea"))')
 page.wait_for_function('!document.querySelector("form [data-testid=ghost]").hasAttribute("data-quiet-composer-hidden")')
 assert not errors, errors
 print('PASS: target restored if it gains an editor; no JavaScript page errors')
 # Additional case based on the observed live ProseMirror widget structure.
 page2=browser.new_page()
 page2.set_content((ROOT/'tests/widget-fixture.html').read_text())
 page2.add_script_tag(content=MOCK)
 page2.add_script_tag(path=str(ROOT/'protocol.js'))
 page2.add_style_tag(path=str(ROOT/'content.css'))
 page2.add_script_tag(path=str(ROOT/'content.js'))
 page2.wait_for_function('document.documentElement.getAttribute("data-quiet-composer-enabled")==="true"')
 widget='[data-composer-input] [data-cumberbatch]'
 assert not page2.locator(widget).is_visible()
 assert page2.locator('[role="textbox"]').is_visible()
 assert page2.locator('button').is_visible()
 assert page2.locator('article [data-cumberbatch]').is_visible()
 assert page2.evaluate('sendExtension({type:"quiet-composer-check",selector:"[data-cumberbatch]"})')['count']==1
 assert page2.evaluate('sendExtension({type:"quiet-composer-check",selector:".cumberbatch-content p span"})')['count']==1
 assert page2.evaluate('sendExtension({type:"quiet-composer-check",selector:".ProseMirror"})')['count']==0
 page2.evaluate('chrome.storage.local.set({selector:"",enabled:false})')
 page2.wait_for_function('document.documentElement.getAttribute("data-quiet-composer-enabled")==="false"')
 assert page2.locator(widget).is_visible()
 page2.evaluate('chrome.storage.local.set({enabled:true})')
 page2.wait_for_function('document.documentElement.getAttribute("data-quiet-composer-enabled")==="true"')
 assert not page2.locator(widget).is_visible()
 print('PASS: embedded inert widget hidden; original selector accepted; editor/outside content preserved; toggle works')
 browser.close()
