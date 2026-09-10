let user = JSON.parse(localStorage.getItem('user'));
const API = "http://localhost:5000";
let isSignup = false, intendedRole = 'buyer', selectedRating = 0, ratingData = null;
let activeBuyData = null;

// Helper to handle empty inputs for MySQL
const val = (id) => document.getElementById(id).value || null;

function formatDate(dStr) {
    if (!dStr) return "N/A";
    const d = new Date(dStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function notify(m) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = m;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function askConfirm(m, onYes) {
    const mod = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').innerText = m;
    mod.classList.remove('hidden');
    document.getElementById('confirm-yes').onclick = () => { mod.classList.add('hidden'); onYes(); };
    document.getElementById('confirm-no').onclick = () => { mod.classList.add('hidden'); };
}

function selectRole(r) { intendedRole = r; document.getElementById('role-selection').classList.add('hidden'); document.getElementById('auth-form').classList.remove('hidden'); }
function resetAuth() { document.getElementById('role-selection').classList.remove('hidden'); document.getElementById('auth-form').classList.add('hidden'); }
function toggleAuth() { isSignup = !isSignup; document.getElementById('signup-fields').classList.toggle('hidden'); document.getElementById('auth-title').innerText = isSignup ? 'Sign Up' : 'Login'; }

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const res = await fetch(`${API}${isSignup?'/signup':'/login'}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, password, role: intendedRole, username: document.getElementById('reg-name').value, campus: document.getElementById('reg-campus').value })
    });
    const data = await res.json();
    if (res.ok) {
        if(data.user) { localStorage.setItem('user', JSON.stringify(data.user)); location.reload(); }
        else notify("Success! Please Login.");
    } else notify(data.error || "Failed");
}

function showView(vid) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + vid).classList.add('active');
    document.querySelectorAll('#nav-tabs button').forEach(b => b.className = 'font-bold pb-2 inactive-tab');
    const tid = {'market':'tab-market','wanted':'tab-wanted','seller':'tab-dashboard','seller-offers':'tab-seller-offers','bargains':'tab-bargains','orders':'tab-orders','cart':'tab-cart'}[vid];
    if(document.getElementById(tid)) document.getElementById(tid).className = 'font-bold pb-2 active-tab';

    if(vid === 'market') loadMarketplace();
    if(vid === 'seller') loadSellerData();
    if(vid === 'seller-offers') loadSellerOffers();
    if(vid === 'bargains') loadBuyerOffers();
    if(vid === 'orders') loadOrders();
    if(vid === 'cart') loadCart();
    if(vid === 'wanted') loadRequests();
}

async function loadSellerOffers() {
    let o = await (await fetch(`${API}/seller-offers/${user.id}`)).json();
    o.sort((a, b) => b.id - a.id);

    document.getElementById('seller-offers-list').innerHTML = o.map(x => `
        <div class="bg-white p-6 rounded-[32px] border shadow-md">
            <div class="flex justify-between items-start mb-6">
                <h4 class="font-black text-xl text-gray-800">${x.title}</h4>
                <p class="text-2xl font-black text-indigo-600">₹${x.offered_price}</p>
            </div>
            ${x.status === 'pending' ? `
                <div class="bg-gray-50 p-4 rounded-2xl mb-4 space-y-3">
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-1">Select Proposed Slot</p>
                    <select id="slot-${x.id}" onchange="toggleSlotC(${x.id})" class="custom-input font-bold text-gray-700">
                        <option value="1" data-p="${x.p1}" data-d="${x.d1}" data-t="${x.t1}">Option 1: ${x.p1} | ${formatDate(x.d1)} | ${x.t1}</option>
                        <option value="2" data-p="${x.p2}" data-d="${x.d2}" data-t="${x.t2}">Option 2: ${x.p2} | ${formatDate(x.d2)} | ${x.t2}</option>
                        <option value="3" data-p="${x.p3}" data-d="${x.d3}" data-t="${x.t3}">Option 3: ${x.p3} | ${formatDate(x.d3)} | ${x.t3}</option>
                        <option value="custom">-- Suggest Custom Slot --</option>
                    </select>
                    <div id="custom-fields-${x.id}" class="hidden space-y-2 mt-3">
                        <input id="cp-${x.id}" placeholder="Custom Place" class="custom-input text-xs">
                        <input id="cd-${x.id}" type="date" class="custom-input text-xs">
                        <input id="ct-${x.id}" placeholder="Custom Time" class="custom-input text-xs">
                    </div>
                </div>
                <div class="flex gap-2">
                    <button id="btn-confirm-${x.id}" onclick="saveDecision(${x.id})" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg">Confirm Deal</button>
                    <button onclick="handleStatus(${x.id}, 'rejected')" class="bg-red-100 text-red-800 px-4 py-3 rounded-xl font-bold">Reject</button>
                </div>
            ` : `
                <div class="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div class="text-[10px] font-black text-indigo-400 uppercase mb-2 text-center">Confirmed Details</div>
                    <div class="grid grid-cols-3 gap-2 text-[10px] font-bold text-gray-700 text-center">
                        <div>📍 ${x.selected_p || 'N/A'}</div>
                        <div>📅 ${formatDate(x.selected_d)}</div>
                        <div>⏰ ${x.selected_t || 'N/A'}</div>
                    </div>
                    <div class="mt-3 p-2 bg-indigo-600 text-white rounded-lg text-center font-black text-[10px] uppercase">Status: ${x.status}</div>
                </div>
            `}
        </div>`).join('') || '<p class="col-span-2 text-center py-20 text-gray-400 font-bold uppercase text-xs">No offers yet</p>';
}

function toggleSlotC(id) {
    const isC = document.getElementById(`slot-${id}`).value === 'custom';
    document.getElementById(`custom-fields-${id}`).classList.toggle('hidden', !isC);
}

async function saveDecision(id) {
    const btn = document.getElementById(`btn-confirm-${id}`);
    const select = document.getElementById(`slot-${id}`);
    const selectedOption = select.options[select.selectedIndex];
    let p, d, t, status;
    if (select.value === 'custom') {
        p = val(`cp-${id}`);
        d = val(`cd-${id}`);
        t = val(`ct-${id}`);
        status = 'countered';
        if(!p || !d || !t) return notify("Please fill custom fields");
    } else {
        p = selectedOption.getAttribute('data-p');
        d = selectedOption.getAttribute('data-d');
        t = selectedOption.getAttribute('data-t');
        status = 'accepted';
    }
    btn.innerText = "Processing...";
    btn.disabled = true;
    const res = await fetch(`${API}/handle-offer`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ offer_id: id, status: status, selected_p: p, selected_d: d, selected_t: t })
    });
    if(res.ok) {
        btn.innerText = status === 'accepted' ? "Deal Accepted ✅" : "Counter Sent ✅";
        btn.style.backgroundColor = "#16a34a"; 
        setTimeout(() => { loadSellerOffers(); }, 1200);
    } else {
        notify("Error updating deal");
        btn.innerText = "Confirm Deal";
        btn.disabled = false;
    }
}

async function handleStatus(id, s) {
    await fetch(`${API}/handle-offer`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({offer_id:id, status:s, selected_p:'', selected_d:'', selected_t:''}) });
    loadSellerOffers();
}

async function loadBuyerOffers() {
    const o = await (await fetch(`${API}/buyer-offers/${user.id}`)).json();
    document.getElementById('buyer-offers-list').innerHTML = o.filter(x => x.status !== 'paid').sort((a,b) => b.id - a.id).map(x => `
        <div class="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                    <h4 class="font-black text-xl text-gray-800">${x.title}</h4>
                    <span class="badge badge-${x.status}">${x.status}</span>
                </div>
                <p class="text-indigo-600 font-black text-lg mb-4">Proposed: ₹${x.offered_price}</p>
                ${x.selected_p ? 
                    `<div class="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50"><div class="grid grid-cols-3 gap-2 text-[10px] font-bold text-gray-700 uppercase"><div>Place: <span class="text-indigo-900">${x.selected_p}</span></div><div>Date: <span class="text-indigo-900">${formatDate(x.selected_d)}</span></div><div>Time: <span class="text-indigo-900">${x.selected_t}</span></div></div></div>` 
                    : (x.status === 'pending' ? '<p class="text-gray-400 text-xs italic">Waiting for seller response...</p>' : '')
                }
            </div>
            <div class="flex items-center gap-3">
                ${(x.status === 'accepted' || x.status === 'countered') ? `<button onclick="confirmPay(${x.product_id}, ${x.seller_id}, ${x.offered_price}, ${x.id})" class="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg">Pay Now</button>` : ''}
                <button onclick="delOffer(${x.id})" class="p-3 text-red-700 bg-red-100 hover:bg-red-200 rounded-xl">🗑️</button>
            </div>
        </div>`).join('') || '<p class="text-center py-20 text-gray-400 font-bold uppercase text-xs">No active bargains</p>';
}

async function loadOrders() {
    const o = await (await fetch(`${API}/buyer-offers/${user.id}`)).json();
    document.getElementById('orders-list').innerHTML = o.filter(x => x.status === 'paid').map(x => `
        <div class="bg-white p-8 rounded-[40px] border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
            <div class="flex-1">
                <h4 class="font-black text-2xl text-gray-800 mb-1">${x.title}</h4>
                <div class="flex items-center gap-4 mb-4"><p class="text-indigo-600 font-black text-lg">₹${x.offered_price}</p><span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Completed</span></div>
                <div class="text-[11px] font-bold text-gray-500 uppercase flex gap-4 bg-gray-50 p-3 rounded-2xl border border-gray-100"><span>📍 ${x.selected_p}</span><span>📅 ${formatDate(x.selected_d)}</span><span>⏰ ${x.selected_t}</span></div>
            </div>
            <div class="w-full md:w-auto">${x.is_rated ? '<span class="block text-center bg-gray-100 text-gray-400 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest">Feedback Sent</span>' : `<button onclick="openRating(${x.product_id}, ${x.seller_id})" class="w-full bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">Rate Seller</button>`}</div>
        </div>`).join('') || '<p class="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest">No orders found</p>';
}

async function loadCart() {
    const items = await (await fetch(`${API}/cart/${user.id}`)).json();
    document.getElementById('cart-list').innerHTML = items.map(x => `
        <div class="bg-white p-6 rounded-[28px] border flex justify-between items-center shadow-sm">
            <div><p class="font-black text-gray-800">${x.title}</p><p class="text-indigo-600 font-black">₹${x.price}</p></div>
            <div class="flex items-center gap-2">
                <button onclick="openBuySchedule(${x.id}, ${x.seller_id}, ${x.price})" class="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Buy</button>
                <button onclick="delCart(${x.cart_id})" class="p-2 text-red-700 bg-red-100 hover:bg-red-200 rounded-xl">🗑️</button>
            </div>
        </div>`).join('') || '<p class="text-center py-20 text-gray-400 font-bold text-xs uppercase">Empty Cart</p>';
}

async function delCart(id) { askConfirm("Remove from cart?", async () => { await fetch(`${API}/cart/${id}`, { method:'DELETE' }); notify("Removed"); loadCart(); }); }

async function loadMarketplace() {
    const all = document.getElementById('show-all-campus').checked;
    const cat = document.getElementById('market-cat-filter').value;
    const s = document.getElementById('market-search').value.toLowerCase();
    const p = await (await fetch(`${API}/products?campus=${all ? 'all' : user.campus}`)).json();
    document.getElementById('marketplace-grid').innerHTML = p.filter(x => {
        const matchesCat = (cat === 'all' || x.category === cat);
        const matchesSearch = x.title.toLowerCase().includes(s);
        return matchesCat && matchesSearch;
    }).map(x => {
        const rating = x.seller_rating ? `⭐ ${Number(x.seller_rating).toFixed(1)}` : '⭐ New';
        return `
        <div onclick="viewProduct(${x.id})" class="bg-white p-6 rounded-[32px] border shadow-sm cursor-pointer hover:shadow-2xl transition transform hover:-translate-y-1">
            <div class="flex justify-between items-start mb-2">
                <span class="text-[9px] font-black text-indigo-500 uppercase tracking-widest">${x.campus}</span>
                <span class="text-[10px] font-bold text-amber-500">${rating}</span>
            </div>
            <h3 class="font-bold text-gray-800 text-sm mb-1 truncate">${x.title}</h3>
            <div class="flex justify-between items-center mb-2">
                <p class="text-indigo-600 font-black text-lg">₹${x.price}</p>
                <span class="text-[9px] font-black px-2 py-1 bg-gray-100 rounded text-gray-500 uppercase">${x.item_condition || 'Used'}</span>
            </div>
        </div>`}).join('');
}

async function viewProduct(id) {
    const p = await (await fetch(`${API}/products/${id}`)).json();
    showView('detail');
    document.getElementById('detail-content').innerHTML = `
        <div class="bg-white rounded-[40px] shadow-2xl border overflow-hidden flex flex-col md:flex-row">
            <div class="p-10 flex-1 border-r">
                <div class="flex justify-between items-start mb-2">
                    <h2 class="text-4xl font-black text-gray-800 leading-tight">${p.title}</h2>
                    <span class="bg-gray-100 text-gray-600 px-4 py-1 rounded-full text-[10px] font-black uppercase mt-2">${p.item_condition || 'Used'}</span>
                </div>
                <p class="text-gray-400 font-bold mb-6 text-[10px] uppercase tracking-widest">Seller: ${p.username} • ${p.campus}</p>
                <div class="price-tag inline-block px-8 py-4 rounded-2xl text-white mb-6"><p class="text-3xl font-black">₹${p.price}</p></div>
                <p class="text-gray-600 text-sm mb-8">${p.description || "No description."}</p>
                <div class="flex gap-3"><button onclick="addToCart(${p.id})" class="flex-1 border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-black">Cart</button><button onclick="openBuySchedule(${p.id}, ${p.seller_id}, ${p.price})" class="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black">Buy Now</button></div>
            </div>
            <div class="bg-indigo-50/50 p-8 w-full md:w-[420px]">
                <h4 class="font-black text-2xl text-gray-800 mb-6 uppercase">Bargain</h4>
                <div class="space-y-4"><input id="o-price" type="number" placeholder="Bargain Price (₹)" class="custom-input font-black text-lg">${[1, 2, 3].map(i => `<div class="bg-white p-4 rounded-2xl border border-gray-100"><p class="text-[9px] font-black text-indigo-400 uppercase mb-2">Option ${i}</p><input id="op${i}" placeholder="Place" class="custom-input text-xs mb-2"><div class="grid grid-cols-2 gap-2"><input id="od${i}" type="date" class="custom-input text-xs"><input id="ot${i}" placeholder="Time" class="custom-input text-xs"></div></div>`).join('')}</div>
                <button onclick="sendBargain(${p.id}, ${p.seller_id})" class="w-full bg-indigo-900 text-white py-5 rounded-[24px] font-black mt-8 shadow-lg">Submit Bargain</button>
            </div>
        </div>`;
}

function openBuySchedule(pId, sId, price) {
    activeBuyData = { pId, sId, price };
    const container = document.getElementById('buy-schedule-fields');
    container.innerHTML = [1, 2, 3].map(i => `
        <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p class="text-[9px] font-black text-indigo-400 uppercase mb-2">Option ${i}</p>
            <input id="bs-p${i}" placeholder="Place" class="custom-input text-xs mb-2">
            <div class="grid grid-cols-2 gap-2">
                <input id="bs-d${i}" type="date" class="custom-input text-xs">
                <input id="bs-t${i}" placeholder="Time" class="custom-input text-xs">
            </div>
        </div>`).join('');
    document.getElementById('buy-schedule-modal').classList.remove('hidden');
}

async function submitScheduledBuy() {
    const { pId, sId, price } = activeBuyData;
    const body = { 
        product_id: pId, buyer_id: user.id, seller_id: sId, offered_price: price, 
        p1: val('bs-p1'), p2: val('bs-p2'), p3: val('bs-p3'), 
        d1: val('bs-d1'), d2: val('bs-d2'), d3: val('bs-d3'), 
        t1: val('bs-t1'), t2: val('bs-t2'), t3: val('bs-t3') 
    };
    if(!body.p1 || !body.d1 || !body.t1) return notify("Please fill Option 1");
    const res = await fetch(`${API}/make-offer`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    if(res.ok) {
        document.getElementById('buy-schedule-modal').classList.add('hidden');
        notify("Request Sent!"); showView('bargains');
    } else notify("Failed to send request");
}

async function sendBargain(pId, sId) {
    const oPrice = document.getElementById('o-price').value;
    if(!oPrice) return notify("Enter a price");
    const body = { 
        product_id: pId, buyer_id: user.id, seller_id: sId, offered_price: oPrice, 
        p1: val('op1'), p2: val('op2'), p3: val('op3'), 
        d1: val('od1'), d2: val('od2'), d3: val('od3'), 
        t1: val('ot1'), t2: val('ot2'), t3: val('ot3') 
    };
    const res = await fetch(`${API}/make-offer`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    if(res.ok) { notify("Proposal Sent!"); showView('bargains'); }
    else notify("Failed to send bargain");
}

function confirmPay(pId, sId, amt, oId = null) { askConfirm(`Confirm payment of ₹${amt}?`, async () => { await fetch(`${API}/pay`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({product_id:pId, buyer_id:user.id, seller_id:sId, amount:amt, offer_id:oId})}); notify("Success!"); showView('orders'); }); }

async function postProduct() {
    const data = { 
        seller_id: user.id, 
        campus: user.campus, 
        title: document.getElementById('p-title').value, 
        price: document.getElementById('p-price').value, 
        category: document.getElementById('p-category').value, 
        description: document.getElementById('p-desc').value,
        item_condition: document.getElementById('p-condition').value 
    };
    if(!data.title || !data.price) return notify("Missing Info");
    await fetch(`${API}/products`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    document.getElementById('p-title').value = ''; document.getElementById('p-price').value = ''; document.getElementById('p-desc').value = '';
    notify("Listed!"); showView('seller');
}

async function loadSellerData() {
    const p = await (await fetch(`${API}/my-products/${user.id}`)).json();
    document.getElementById('my-products').innerHTML = p.map(x => `
        <div class="p-5 border rounded-[24px] bg-white flex justify-between items-center shadow-sm ${x.status === 'sold' ? 'border-green-100' : ''}">
            <div><p class="font-black text-gray-800">${x.title}</p><p class="text-indigo-600 font-bold">₹${x.price}</p></div>
            ${x.status === 'sold' ? '<span class="sold-tag px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Sold</span>' : `<button onclick="delProd(${x.id})" class="text-red-800 font-bold text-xs bg-red-200 px-4 py-2 rounded-xl hover:bg-red-300">DEL</button>`}
        </div>`).join('');
}

async function addToCart(id) { await fetch(`${API}/cart`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:user.id, product_id:id}) }); notify("Added to Cart"); }

async function submitRequest() {
    const t = document.getElementById('req-title').value;
    if(!t) return notify("Enter title");
    await fetch(`${API}/requests`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:user.id, title:t, description: document.getElementById('req-desc').value})});
    document.getElementById('req-title').value = ''; document.getElementById('req-desc').value = '';
    notify("Posted!"); loadRequests();
}

async function loadRequests() {
    const r = await (await fetch(`${API}/requests`)).json();
    document.getElementById('requests-list').innerHTML = r.map(x => `
        <div class="bg-white p-6 rounded-3xl border flex justify-between items-center">
            <div><h4 class="font-black text-indigo-800 uppercase text-sm">${x.title}</h4><p class="text-xs text-gray-500">${x.description || ''}</p></div>
            ${x.user_id === user.id ? `<button onclick="delReq(${x.id})" class="text-red-800 bg-red-200 px-4 py-2 rounded-xl text-xs font-bold">DEL</button>` : ''}
        </div>`).join('');
}

function openRating(pId, sId) { ratingData = { product_id: pId, seller_id: sId, buyer_id: user.id }; document.getElementById('rating-modal').classList.remove('hidden'); }
function setRating(v) { selectedRating = v; document.querySelectorAll('.star-btn').forEach((b, i) => b.style.color = i < v ? '#fbbf24' : '#d1d5db'); }
async function submitRating() { await fetch(`${API}/rate`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...ratingData, rating: selectedRating})}); document.getElementById('rating-modal').classList.add('hidden'); loadOrders(); }
async function delProd(id) { askConfirm("Delete item?", async () => { await fetch(`${API}/products/${id}`,{method:'DELETE'}); loadSellerData(); }); }
async function delOffer(id) { askConfirm("Cancel bargain?", async () => { await fetch(`${API}/offers/${id}`,{method:'DELETE'}); loadBuyerOffers(); }); }
async function delReq(id) { askConfirm("Remove request?", async () => { await fetch(`${API}/requests/${id}`,{method:'DELETE'}); loadRequests(); }); }

function init() {
    if(!user) { document.getElementById('auth-box').classList.remove('hidden'); return; }
    document.getElementById('app-box').classList.remove('hidden');
    const tabs = document.getElementById('nav-tabs');
    if(user.role === 'seller') {
        tabs.innerHTML = `<button id="tab-dashboard" onclick="showView('seller')" class="font-bold pb-2">Listing Center</button><button id="tab-seller-offers" onclick="showView('seller-offers')" class="font-bold pb-2 inactive-tab">Offers Received</button><button id="tab-wanted" onclick="showView('wanted')" class="font-bold pb-2 inactive-tab">Wanted Board</button>`;
        document.getElementById('buyer-req-box').classList.add('hidden');
        document.getElementById('requests-container').className = 'lg:col-span-3';
        showView('seller');
    } else {
        tabs.innerHTML = `<button id="tab-market" onclick="showView('market')" class="font-bold pb-2">Marketplace</button><button id="tab-bargains" onclick="showView('bargains')" class="font-bold pb-2 inactive-tab">Bargains</button><button id="tab-orders" onclick="showView('orders')" class="font-bold pb-2 inactive-tab">My Orders</button><button id="tab-wanted" onclick="showView('wanted')" class="font-bold pb-2 inactive-tab">Wanted Board</button>`;
        showView('market');
    }
    document.getElementById('user-info').innerHTML = `<div class="text-right leading-none"><p class="font-black text-[9px] text-indigo-400 uppercase">${user.role}</p><p class="font-black text-sm">${user.username}</p></div>${user.role === 'buyer' ? `<button onclick="showView('cart')" id="tab-cart" class="p-3 bg-white/10 rounded-2xl">🛒</button>` : ''}<button onclick="localStorage.clear();location.reload()" class="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-[9px]">LOGOUT</button>`;
}
init();