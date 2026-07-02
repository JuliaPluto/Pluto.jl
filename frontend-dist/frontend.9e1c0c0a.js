import"./frontend.b3f099b4.js";var e=globalThis,t={},o={},r=e.parcelRequire94c2;null==r&&((r=function(e){if(e in t)return t[e].exports;if(e in o){var r=o[e];delete o[e];var n={id:e,exports:{}};return t[e]=n,r.call(n.exports,n,n.exports),n.exports}var l=Error("Cannot find module '"+e+"'");throw l.code="MODULE_NOT_FOUND",l}).register=function(e,t){o[e]=t},e.parcelRequire94c2=r),r.register;var n=r("cNaMA");r("eS9BV"),r("8iRLb");var n=r("cNaMA"),l=r("4zMEb");let a=async()=>{let e=await fetch("https://api.github.com/repos/JuliaPluto/Pluto.jl/releases",{method:"GET",mode:"cors",cache:"no-cache",headers:{"Content-Type":"application/json"},redirect:"follow",referrerPolicy:"no-referrer"});return(await e.json()).reverse()};r("8iRLb");var n=r("cNaMA"),i=r("2ZZ1r"),s=r("9fP3D"),u=r("hrGZZ"),n=r("cNaMA");let c=e=>{let t=`${e}
`.replace("\r\n","\n"),o=t.indexOf("### A Pluto.jl notebook ###"),r=t.match(/# ... ........-....-....-....-............/g),n=r?.length??0,l=t.indexOf("# ╔═╡ Cell order:")+17+1;for(let e=1;e<=n;e++)l=t.indexOf("\n",l+1)+1;return t.slice(o,l)},d=({on_start_navigation:e})=>{let t=async t=>{let o,r,n;if(console.log(t),(t?.path??t?.composedPath()).filter(e=>e?.classList?.contains(".cm-editor"))?.length>0)return;switch(t.type){case"paste":o=c(t.clipboardData.getData("text/plain"));break;case"dragstart":t.dataTransfer.dropEffect="move";return;case"dragover":t.preventDefault();return;case"drop":t.preventDefault(),o=t.dataTransfer.types.includes("Files")?await (r=t.dataTransfer.files[0],new Promise((e,t)=>{let{name:o,type:n}=r,l=new FileReader;l.onerror=()=>t("Failed to read file!"),l.onloadstart=()=>{},l.onprogress=({loaded:e,total:t})=>{},l.onload=()=>{},l.onloadend=()=>e({file:l.result,name:o,type:n}),l.readAsText(r)})).then(({file:e})=>e):c(await (n=t.dataTransfer.items[0],new Promise((e,t)=>{try{n.getAsString(t=>{console.log(t),e(t)})}catch(e){t(e)}})))}if(!o)return;e((0,s.t)("t_loading_something_notebook_from_clipboard"),!1),document.body.classList.add("loading");let l=await fetch("./notebookupload",{method:"POST",body:o});if(l.ok)window.location.href=b(await l.text());else{let e=await l.blob();window.location.href=URL.createObjectURL(e)}};return(0,u.useEventListener)(document,"paste",t,[t]),(0,u.useEventListener)(document,"drop",t,[t]),(0,u.useEventListener)(document,"dragstart",t,[t]),(0,u.useEventListener)(document,"dragover",t,[t]),(0,n.html)`<span />`},p=e=>e.toLowerCase().normalize("NFD").replace(/[^a-z1-9]/g,""),_=async e=>{try{let t=new URL(e);if(!["http:","https:","ftp:","ftps:"].includes(t.protocol))throw"Not a web URL";if("pluto.land"===t.host){console.log("pluto.land URL detected");let e=t.pathname.substring(1).split("/");if(e.length>=2&&"n"===e[0])return{type:"url",display_url:`https://pluto.land/n/${e[1]}`,path_or_url:`https://pluto.land/n/${e[1]}/notebookfile`}}if("gist.github.com"===t.host){console.log("Gist URL detected");let e=t.pathname.substring(1).split("/")[1],o=await (await fetch(`https://api.github.com/gists/${e}`,{headers:{Accept:"application/vnd.github.v3+json"}}).then(e=>e.ok?e:Promise.reject(e))).json();console.log(o);let r=Object.values(o.files),n=r.find(e=>p("#file-"+e.filename)===p(t.hash));if(null!=n)return{type:"url",path_or_url:n.raw_url};return{type:"url",path_or_url:r[0].raw_url}}return"github.com"===t.host&&t.searchParams.set("raw","true"),{type:"url",path_or_url:t.href}}catch(t){return'"'===e[e.length-1]&&'"'===e[0]&&(e=e.slice(1,-1)),{type:"path",path_or_url:e}}};var s=r("9fP3D"),h=r("iNoqM");let f=({client:e,connected:t,CustomPicker:o,show_samples:r,on_start_navigation:l})=>{let a=async e=>{let t=await _(e);l(t.display_url??t.path_or_url),window.location.href=("path"===t.type?m:g)(t.path_or_url)},u=o??{text:(0,s.t)("t_open_a_notebook_action"),placeholder:(0,s.t)("t_enter_path_or_url")};return(0,n.html)`<${d} on_start_navigation=${l} />
        <h2>${u.text}</h2>
        <div id="new" dir="ltr" class=${(0,h.is_desktop)()?"desktop_opener":""}>
            ${(0,h.is_desktop)()?(0,n.html)`
                      <div class="desktop_picker_group">
                          <button onClick=${h.open_from_path}>Open File</button>
                          <div class="option_splitter">— OR —</div>
                          <div>
                              <${i.FilePicker}
                                  key=${u.placeholder}
                                  client=${e}
                                  value=""
                                  on_submit=${h.open_from_url}
                                  button_label=${"Open from URL"}
                                  placeholder=${"Enter a URL..."}
                                  client=${{send:e=>({then:e=>{}})}}
                                  clear_on_blur=${!1}
                              />
                          </div>
                      </div>
                  `:(0,n.html)`
                      <${i.FilePicker}
                          key=${u.placeholder}
                          client=${e}
                          value=""
                          on_submit=${a}
                          clear_on_blur=${!1}
                          button_label=${(0,h.is_desktop)()?(0,s.t)("t_open_file_action"):(0,s.t)("t_open_action")}
                          placeholder=${u.placeholder}
                      />
                  `}
        </div>`},m=(e,t=!1)=>"open?"+new URLSearchParams({path:e}).toString(),g=e=>"open?"+new URLSearchParams({url:e}).toString(),b=e=>"edit?id="+e;var v=r("8iRLb"),n=r("cNaMA"),w=r("aN0pg"),$=r("dYd4C"),s=r("9fP3D");let k=e=>({transitioning:!1,entry:void 0,path:e}),y=e=>({transitioning:!1,entry:e,path:e.path}),P=(e,t)=>e.split(/\/|\\/).slice(-t).join("/"),j=(e,t)=>{let o=1;for(let r of t)if(r!==e)for(;P(e,o)===P(r,o);)o++;return P(e,o)},L=({client:e,connected:t,remote_notebooks:o,CustomRecent:r,on_start_navigation:l})=>{let[a,i]=(0,n.useState)(null),u=(0,n.useRef)(a);u.current=a;let c=(e,t)=>{i(o=>o?.map(o=>o.path==e?{...o,...t}:o)??null)};(0,n.useEffect)(()=>{null!=e&&t&&e.send("get_all_notebooks",{},{}).then(({message:e})=>{let t=e.notebooks.map(e=>y(e)),o=E();i([...v.default.sortBy(t,[e=>v.default.findIndex([...o,...t],t=>t.path===e.path)]),...v.default.differenceBy(o,t,e=>e.path)]),document.body.classList.remove("loading")})},[null!=e&&t]),(0,n.useEffect)(()=>{if(null!=u.current){let e=[],t=u.current.map(t=>{let r=null;if(null==(r=null!=t.entry?o.find(e=>e.notebook_id===t.entry?.notebook_id):o.find(e=>e.path===t.path)))return k(t.path);{let t=y(r);return e.push(r),t}});i([...o.filter(t=>!e.includes(t)).map(y),...t])}},[o]),(0,n.useEffect)(()=>{document.body.classList.toggle("nosessions",!(null==a||a.length>0))},[a]);let d=a?.map(e=>e.path),p=null==a?(0,n.html)`<li class="not_yet_ready"><em>${(0,s.t)("t_loading_ellipses")}</em></li>`:a.map(t=>{let o=null!=t.entry;return(0,n.html)`<li
                      key=${t.path}
                      class=${(0,w.cl)({running:o,recent:!o,transitioning:t.transitioning})}
                  >
                      <button
                          onclick=${()=>(t=>{if(!t.transitioning)if(null!=t.entry){if(null==e)return;confirm(t.entry?.process_status===$.ProcessStatus.waiting_for_permission?(0,s.t)("t_close_notebook_session"):(0,s.t)("t_shut_down_notebook_process"))&&(c(t.path,{running:!1,transitioning:!0}),e.send("shutdown_notebook",{keep_in_session:!1},{notebook_id:t.entry?.notebook_id},!1))}else c(t.path,{transitioning:!0}),fetch(m(t.path)+"&execution_allowed=true",{method:"GET"}).then(e=>{if(!e.redirected)throw Error("file not found maybe? try opening the notebook directly")}).catch(e=>{console.error("Failed to start notebook in background"),console.error(e),c(t.path,{transitioning:!1,notebook_id:null})})})(t)}
                          title=${o?t.entry?.process_status===$.ProcessStatus.waiting_for_permission?(0,s.t)("t_stop_notebook_session"):(0,s.t)("t_shut_down_notebook"):(0,s.t)("t_start_notebook_in_background")}
                      >
                          <span class="ionicon"></span>
                      </button>
                      <a
                          href=${o?b(t.entry?.notebook_id):m(t.path)}
                          title=${t.path}
                          onClick=${e=>{o||(l(j(t.path,d)),c(t.path,{transitioning:!0}))}}
                          >${j(t.path,d)}</a
                      >
                      ${!o&&!t.transitioning?(0,n.html)`<button
                                class="clear-btn"
                                onclick=${e=>{e.preventDefault(),e.stopPropagation(),S(t.path),i(e=>e?.filter(e=>e.path!==t.path)??null)}}
                                title=${(0,s.t)("t_remove_from_recent_notebooks")}
                                aria-label=${(0,s.t)("t_remove_from_recent_notebooks")}
                            >
                                ${(0,s.t)("t_FORGET")}
                            </button>`:null}
                  </li>`});return null==r?(0,n.html)`
            <h2>${(0,s.t)("t_my_work")}</h2>
            <ul id="recent" class="show_scrollbar">
                <li class="new">
                    <a
                        href="new"
                        onClick=${e=>{l((0,s.t)("t_loading_something_new_notebook"))}}
                        ><button><span class="ionicon"></span></button>${(0,s.th)("t_newnotebook")}</a
                    >
                </li>
                ${p}
            </ul>
        `:(0,n.html)`<${r} cl=${w.cl} combined=${a} client=${e} recents=${p} />`},E=()=>{let e=localStorage.getItem("recent notebooks"),t=null!=e?JSON.parse(e):[];return(t instanceof Array?t:[]).map(k)},S=e=>{let t=E().filter(t=>t.path!==e);localStorage.setItem("recent notebooks",JSON.stringify(t.map(e=>e.path)))};var v=r("8iRLb"),n=r("cNaMA"),R=r("h2NGW"),x=r("1Mxs0");r("9fP3D");let C=[{title:"Featured Notebooks",description:"These notebooks from the Julia community show off what you can do with Pluto. Give it a try, you might learn something new!",collections:[{title:"Loading...",tags:[]}],notebooks:{}}],N=(0,n.html)`
    <div class="featured-source">
        <h1>${C[0]?.title}</h1>
        <p>Here are a couple of notebooks to get started with Pluto.jl:</p>
        <ul>
            <li>1. <a href="sample/Getting%20started.jl">Getting started</a></li>
            <li>2. <a href="sample/Markdown.jl">Markdown</a></li>
            <li>3. <a href="sample/Basic%20mathematics.jl">Basic mathematics</a></li>
            <li>4. <a href="sample/Interactivity.jl">Interactivity</a></li>
            <li>5. <a href="sample/PlutoUI.jl.jl">PlutoUI.jl</a></li>
            <li>6. <a href="sample/Plots.jl.jl">Plots.jl</a></li>
            <li>7. <a href="sample/Tower%20of%20Hanoi.jl">Tower of Hanoi</a></li>
            <li>8. <a href="sample/JavaScript.jl">JavaScript</a></li>
        </ul>
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        <p>Tip: <em>Visit this page again when you are connected to the internet to read our online collection of featured notebooks.</em></p>
    </div>
`,O=[{title:"Notebooks",tags:"everything"}],A=e=>e?.id??e.url,D=({sources:e,direct_html_links:t})=>{let[o,r]=(0,n.useState)({});(0,n.useEffect)(()=>{null!=e&&(a(!1),r({}),Promise.any(Array.from(new Set(e.map(A))).map(t=>T(e.filter(e=>A(e)===t).map(async e=>{let{url:o,integrity:r,valid_until:n}=e;if(null!=n&&new Date(n)<new Date)throw Error(`Source ${o} is expired with valid_until ${n}`);let l=await (await fetch(new Request(o,{integrity:r??void 0}))).json();if("2"!==l.format_version)throw Error(`Invalid format version: ${l.format_version}`);return[l,t,o]})).then(([e,t,o])=>{r(r=>({...r,[t]:{...e,source_url:o}}))}))).catch(e=>{console.error("All featured sources failed to load: ",e),(e?.errors??[]).forEach(e=>console.error(e)),a(!0)}))},[e]),(0,n.useEffect)(()=>{Object.entries(o).length>0&&console.log("Sources:",o)},[o]);let[l,a]=(0,n.useState)(!1);(0,n.useEffect)(()=>{setTimeout(()=>{a(!0)},8e3)},[]);let i=0===Object.entries(o).length,s=Array.from(new Set(e?.map(A)??[])).map(e=>o[e]).filter(e=>null!=e);return i&&l?N:(0,n.html)`
              ${(i?C:s).map(e=>{let o=e?.collections??O;return(0,n.html)`
                      <div class="featured-source">
                          <h1>${e.title}</h1>
                          <p>${e.description}</p>
                          ${o.map(o=>(0,n.html)`
                                  <div class="collection">
                                      <h2>${o.title}</h2>
                                      <p>${o.description}</p>
                                      <div class="card-list">
                                          ${M(Object.values(e.notebooks),o.tags??[]).map(o=>(0,n.html)`<${x.FeaturedCard} entry=${o} source_manifest=${e} direct_html_links=${t} />`)}
                                      </div>
                                  </div>
                              `)}
                      </div>
                  `})}
          `};(0,R.default)(D,"pluto-featured",["sources","direct_html_links"]);let M=(e,t)=>{let o="everything"===t?e:e.filter(e=>t.some(t=>(e.frontmatter?.tags??[]).includes(t)));return v.default.sortBy(o,[e=>{let t;return isNaN(t=e?.frontmatter?.order)?t:Number(t)},"id"])},T=(e,t=[])=>{let o=e[0];return e.length<=1||null==o?Promise.any([...e,...t]):o.catch(()=>T(e.slice(1),[...t,o]))};var U=r("cpCG6"),F=[{url:"https://featured.plutojl.org/pluto_export.json",valid_until:"2032-10",id:"featured pluto"},{id:"featured pluto",url:"https://cdn.jsdelivr.net/gh/JuliaPluto/featured@v6/pluto_export.json",integrity:"sha256-wWpIME7NqdQfspMICXLI6PDM3H+jthqoBhP3uaWnwlM="},{url:"https://plutojl.org/pluto_export.json",valid_until:"2032-10",id:"pluto website"}],s=r("9fP3D"),h=r("iNoqM");let I=document.head.querySelector("link[rel='pluto-logo-big']")?.getAttribute("href")??"";var s=r("9fP3D");let q=new URLSearchParams(window.location.search),G={featured_direct_html_links:!!(q.get("featured_direct_html_links")??window.pluto_featured_direct_html_links),featured_sources:window.pluto_featured_sources,featured_source_url:q.get("featured_source_url")??window.pluto_featured_source_url,featured_source_integrity:q.get("featured_source_integrity")??window.pluto_featured_source_integrity,pluto_server_url:q.get("pluto_server_url")??window.pluto_server_url};console.log("Launch parameters: ",G),document.documentElement.lang=(0,s.getCurrentLanguage)(),document.documentElement.dir=(0,s.getWritingDirection)(),(0,n.render)((0,n.html)`<${({launch_params:e})=>{let[t,o]=(0,n.useState)([]),[r,i]=(0,n.useState)(!1),[u,c]=(0,n.useState)({show_samples:!0,CustomPicker:null,CustomRecent:null}),d=(0,n.useRef)({});(0,n.useEffect)(()=>{(0,l.create_pluto_connection)({on_unrequested_update:({message:e,type:t})=>{"notebook_list"===t&&o(e.notebooks)},on_connection_status:i,on_reconnect:async()=>!0,ws_address:e.pluto_server_url?(0,l.ws_address_from_base)(e.pluto_server_url):void 0}).then(async e=>{Object.assign(d.current,e),i(!0);try{let{custom_recent:t,custom_filepicker:o,show_samples:r=!0}=(await (0,U.get_environment)(e))({client:e,editor:void 0,imports:{preact:n}});c(e=>({...e,CustomRecent:t,CustomPicker:o,show_samples:r}))}catch(e){}a().then(t=>{let o=e.version_info.pluto,r=t[t.length-1].tag_name;console.log(`Pluto version ${o}`);let n=t.findIndex(e=>e.tag_name===o);-1!==n&&t.slice(n+1).filter(e=>e.body.toLowerCase().includes("recommended update")).length>0&&(console.log(`Newer version ${r} is available`),e.version_info.dismiss_update_notification||alert("A new version of Pluto.jl is available! 🎉\n\n    You have "+o+", the latest is "+r+'.\n\nYou can update Pluto.jl using the julia package manager:\n    import Pkg; Pkg.update("Pluto")\nAfterwards, exit Pluto.jl and restart julia.'))}).catch(()=>{}),e.send("current_time"),e.send("completepath",{query:""},{})})},[]),(0,n.useEffect)(()=>{(0,h.add_block_screen_text_listener)(e=>{b(e)})},[]);let{show_samples:p,CustomRecent:_,CustomPicker:m}=u,[g,b]=(0,n.useState)(null),v=(e,t=!0)=>{if(t){let t=t=>{b(e)};window.addEventListener("beforeunload",t),setTimeout(()=>window.removeEventListener("beforeunload",t),1e3)}else b(e)},w=n.useMemo(()=>e.featured_sources??(e.featured_source_url?[{url:e.featured_source_url,integrity:e.featured_source_integrity}]:F),[e]);return null!=g?(0,n.html)`
            <div class="navigating-away-banner">
                <h2>${(0,s.th)("t_loading_something",{text:g})}</h2>
            </div>
        `:(0,n.html)`
        <section id="title">
            <h1>${(0,s.th)("t_welcome_to_pluto",{pluto:(0,n.html)`<img src=${I} />`})}</h1>
        </section>
        <section id="mywork">
            <div>
                <${L}
                    client=${d.current}
                    connected=${r}
                    remote_notebooks=${t}
                    CustomRecent=${_}
                    on_start_navigation=${v}
                />
            </div>
        </section>
        <section id="open">
            <div>
                <${f}
                    client=${d.current}
                    connected=${r}
                    CustomPicker=${m}
                    show_samples=${p}
                    on_start_navigation=${v}
                />
            </div>
        </section>
        <section id="featured" dir="ltr">
            <div>
                <${D} sources=${w} direct_html_links=${e.featured_direct_html_links} />
            </div>
        </section>
    `}} launch_params=${G} />`,document.querySelector("#app"));