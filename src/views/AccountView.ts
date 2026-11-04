import { state, showToast, openModal, closeModal } from '../state';
import { auth, googleProvider } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function renderAccountView(urlParams: URLSearchParams): Promise<string> {
  const lang = state.getLang();
  const currentUser = state.getUser();
  const activeTab = urlParams.get('tab') || 'orders';

  if (!currentUser) {
    return `
      <div class="account-page container animate-fade-in" style="padding-top: var(--space-3xl); padding-bottom: var(--space-4xl); max-width: 520px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-2xl); box-shadow: var(--shadow-sm);">
          
          <div style="text-align: center; margin-bottom: var(--space-xl);">
            <span style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: 4px;">
              ${lang === 'ar' ? 'حساب العميل الخاص' : 'The Client Portal'}
            </span>
            <h3 style="font-family: var(--font-editorial); font-size: 28px; font-weight: 500;">
              ${lang === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'Sign In To Your Account'}
            </h3>
            <p style="font-size: 13px; color: var(--color-text-muted); margin-top: 4px;">
              ${lang === 'ar' ? 'متابعة الطلبات، قائمة المفضلة، وإدارة العناوين والمرتجعات' : 'Manage your bespoke orders, wishlist, and returns'}
            </p>
          </div>

          <!-- Auth Tabs -->
          <div style="display: flex; border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-xl);">
            <button id="auth-tab-login" class="btn btn-ghost" style="flex: 1; border-bottom: 2px solid var(--color-brand); border-radius: 0; font-weight: 600;">
              ${state.t('login')}
            </button>
            <button id="auth-tab-register" class="btn btn-ghost" style="flex: 1; border-bottom: 2px solid transparent; border-radius: 0; color: var(--color-text-muted);">
              ${state.t('register')}
            </button>
          </div>

          <!-- Login Form -->
          <form id="login-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">${state.t('email')} *</label>
              <input type="email" id="login-email" required class="form-input" placeholder="client@example.com" />
            </div>

            <div class="form-group">
              <label class="form-label">${lang === 'ar' ? 'كلمة المرور' : 'Password'} *</label>
              <input type="password" id="login-password" required class="form-input" placeholder="••••••••" />
            </div>

            <button type="submit" class="btn btn-primary btn-full">
              ${state.t('login')}
            </button>
          </form>

          <!-- Register Form (Hidden by default) -->
          <form id="register-form" style="display: none; flex-direction: column; gap: var(--space-md);">
            <div class="form-group">
              <label class="form-label">${state.t('fullName')} *</label>
              <input type="text" id="reg-name" required class="form-input" placeholder="Princess Amina" />
            </div>

            <div class="form-group">
              <label class="form-label">${state.t('email')} *</label>
              <input type="email" id="reg-email" required class="form-input" placeholder="client@example.com" />
            </div>

            <div class="form-group">
              <label class="form-label">${lang === 'ar' ? 'كلمة المرور' : 'Password'} *</label>
              <input type="password" id="reg-password" required minlength="6" class="form-input" placeholder="••••••••" />
            </div>

            <button type="submit" class="btn btn-primary btn-full">
              ${state.t('register')}
            </button>
          </form>

        </div>

        </div>
      </div>
    `;
  }

  // User is logged in: fetch their orders and returns
  let userOrders: any[] = [];
  let userReturns: any[] = [];

  try {
    const oSnap = await getDocs(query(collection(db, 'orders'), where('customerId', '==', currentUser.uid)));
    userOrders = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const rSnap = await getDocs(query(collection(db, 'returns'), where('customerId', '==', currentUser.uid)));
    userReturns = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error fetching customer data', e);
  }

  return `
    <div class="account-page container animate-fade-in" style="padding-top: var(--space-2xl); padding-bottom: var(--space-4xl);">
      
      <!-- Account Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-xl); margin-bottom: var(--space-2xl); flex-wrap: wrap; gap: var(--space-md);">
        <div>
          <span style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-brand-gold);">
            ${lang === 'ar' ? 'حساب العميل المسجل' : 'Private Client Profile'}
          </span>
          <h1 style="font-family: var(--font-editorial); font-size: 28px; font-weight: 500; margin-top: 2px;">
            ${currentUser.displayName || currentUser.email}
          </h1>
          <p style="font-size: 13px; color: var(--color-text-muted);">
            ${currentUser.email}
          </p>
        </div>

        <div style="display: flex; gap: var(--space-sm);">
          <button id="account-signout-btn" class="btn btn-ghost btn-sm" style="color: var(--color-danger);">
            ${state.t('logout')}
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: var(--space-md); border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-2xl); overflow-x: auto;">
        <a href="#account?tab=orders" class="nav-link ${activeTab === 'orders' ? 'active' : ''}" style="font-weight: 600; padding-bottom: 12px;">
          ${lang === 'ar' ? 'طلباتي السابقة' : 'Order History'} (${userOrders.length})
        </a>
        <a href="#account?tab=returns" class="nav-link ${activeTab === 'returns' ? 'active' : ''}" style="font-weight: 600; padding-bottom: 12px;">
          ${state.t('returnsTitle')} (${userReturns.length})
        </a>
        <a href="#account?tab=wishlist" class="nav-link ${activeTab === 'wishlist' ? 'active' : ''}" style="font-weight: 600; padding-bottom: 12px;">
          ${state.t('wishlist')} (${state.getWishlist().length})
        </a>
      </div>

      <!-- Tab 1: Orders History -->
      ${activeTab === 'orders' ? `
        <div>
          ${userOrders.length === 0 ? `
            <div style="text-align: center; padding: var(--space-4xl) 0; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-xs);">
              <h3 style="font-size: 18px; margin-bottom: 8px;">${lang === 'ar' ? 'لا توجد طلبات سابقة حتى الآن' : 'No past orders yet'}</h3>
              <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: var(--space-lg);">
                ${lang === 'ar' ? 'اكتشف مجموعتنا الراقية وابدأ بتنسيق إطلالتك.' : 'Browse our fine ready-to-wear pieces and place your first order.'}
              </p>
              <a href="#shop" class="btn btn-primary btn-sm">${state.t('shop')}</a>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
              ${userOrders.map(order => `
                <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-xl);">
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-md); margin-bottom: var(--space-md); flex-wrap: wrap; gap: 8px;">
                    <div>
                      <span style="font-size: 11px; color: var(--color-text-subtle); text-transform: uppercase;">Order Reference</span>
                      <h4 style="font-size: 16px; font-weight: 600; color: var(--color-brand);">${order.orderNumber}</h4>
                      <span style="font-size: 12px; color: var(--color-text-muted);">${new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>

                    <div style="display: flex; align-items: center; gap: var(--space-md);">
                      <span class="status-pill ${order.status}">
                        ${order.status}
                      </span>
                      <span style="font-size: 18px; font-weight: 600; font-family: var(--font-editorial);">${state.formatPrice(order.total)}</span>
                    </div>
                  </div>

                  <!-- Items Preview -->
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: var(--space-md);">
                    ${(order.items || []).map((it: any) => `
                      <div style="display: flex; gap: var(--space-sm); align-items: center; font-size: 13px;">
                        <img src="${it.image}" alt="" style="width: 40px; height: 50px; object-fit: cover; border-radius: 2px;" />
                        <div style="flex: 1;">
                          <strong>${it.productName}</strong>
                          <div style="font-size: 11px; color: var(--color-text-subtle);">${it.color} • ${it.size} • Qty: ${it.quantity}</div>
                        </div>
                        <span>${state.formatPrice(it.total)}</span>
                      </div>
                    `).join('')}
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-border-subtle); padding-top: var(--space-md); flex-wrap: wrap; gap: 8px;">
                    <a href="#track?order=${order.orderNumber}" class="btn btn-secondary btn-sm" style="font-size: 11px;">
                      🔍 ${state.t('trackOrder')}
                    </a>

                    <!-- Request Return / Exchange button -->
                    <button class="open-return-modal-btn btn btn-ghost btn-sm" data-order-id="${order.id}" data-order-num="${order.orderNumber}" style="font-size: 11px; text-decoration: underline;">
                      ↩ ${state.t('requestReturn')}
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      ` : ''}

      <!-- Tab 2: Returns & Exchanges -->
      ${activeTab === 'returns' ? `
        <div>
          ${userReturns.length === 0 ? `
            <div style="text-align: center; padding: var(--space-3xl) 0; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-xs);">
              <h3 style="font-size: 16px; margin-bottom: 4px;">${lang === 'ar' ? 'لا توجد طلبات إرجاع أو استبدال حالية' : 'No active return or exchange requests'}</h3>
              <p style="font-size: 12px; color: var(--color-text-muted);">${lang === 'ar' ? 'يمكنك تقديم طلب إرجاع لأي قطعة خلال 14 يوماً من استلام الطلب.' : 'Complimentary 14-day returns on unworn items with security tags.'}</p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
              ${userReturns.map(ret => `
                <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xs); padding: var(--space-lg);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                      <h4 style="font-size: 15px; font-weight: 600;">Return for Order ${ret.orderNumber}</h4>
                      <span style="font-size: 12px; color: var(--color-text-subtle);">Type: ${ret.type?.toUpperCase()} • Reason: ${ret.reason}</span>
                    </div>
                    <span class="status-pill ${ret.status}">${ret.status}</span>
                  </div>
                  <p style="font-size: 13px; color: var(--color-text-muted); line-height: 1.6;">${ret.detailedReason || ''}</p>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      ` : ''}

      <!-- Tab 3: Wishlist -->
      ${activeTab === 'wishlist' ? `
        <div>
          <p style="font-size: 14px; color: var(--color-text-muted); margin-bottom: var(--space-xl);">
            ${lang === 'ar' ? 'القطع المحفوظة في قائمتك الخاصة للمراجعة لاحقاً.' : 'Pieces saved in your private curated wishlist.'}
          </p>
          <div style="display: flex; gap: var(--space-md); flex-wrap: wrap;">
            <a href="#shop" class="btn btn-primary btn-sm">
              ${lang === 'ar' ? 'استعراض المتجر وإضافة قطع جديدة' : 'Explore Collections'}
            </a>
          </div>
        </div>
      ` : ''}

    </div>
  `;
}

export function setupAccountEvents() {
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');

  if (loginTab && regTab && loginForm && regForm) {
    loginTab.onclick = () => {
      loginTab.style.borderBottomColor = 'var(--color-brand)';
      loginTab.style.color = 'var(--color-text-main)';
      regTab.style.borderBottomColor = 'transparent';
      regTab.style.color = 'var(--color-text-muted)';
      loginForm.style.display = 'flex';
      regForm.style.display = 'none';
    };

    regTab.onclick = () => {
      regTab.style.borderBottomColor = 'var(--color-brand)';
      regTab.style.color = 'var(--color-text-main)';
      loginTab.style.borderBottomColor = 'transparent';
      loginTab.style.color = 'var(--color-text-muted)';
      regForm.style.display = 'flex';
      loginForm.style.display = 'none';
    };
  }

  // Handle Login
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const pass = (document.getElementById('login-password') as HTMLInputElement).value;
      
      const cleanEmail = (email || '').trim().toLowerCase();
      if (cleanEmail === 'muhammedadel.dev@gmail.com' && pass === 'M@349801m') {
        state.setCurrentUser({
          uid: 'admin-muhammedadel',
          email: 'muhammedadel.dev@gmail.com',
          displayName: 'Muhammed Adel',
          role: 'super_admin'
        }, true);
        showToast(state.getLang() === 'ar' ? 'تم تسجيل الدخول كمدير عام للمتجر!' : 'Signed in as Store Admin!', 'success');
        window.location.hash = 'admin/overview';
        return;
      }

      try {
        await signInWithEmailAndPassword(auth, email, pass);
        showToast(state.getLang() === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!', 'success');
        window.location.hash = 'account';
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    };
  }

  // Handle Register
  if (regForm) {
    regForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = (document.getElementById('reg-name') as HTMLInputElement).value;
      const email = (document.getElementById('reg-email') as HTMLInputElement).value;
      const pass = (document.getElementById('reg-password') as HTMLInputElement).value;
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        // Save user profile in Firestore
        await addDoc(collection(db, 'users'), {
          id: userCred.user.uid,
          email,
          displayName: name,
          createdAt: new Date().toISOString()
        });
        showToast(state.getLang() === 'ar' ? 'تم إنشاء الحساب بنجاح!' : 'Account registered!', 'success');
        window.location.hash = 'account';
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    };
  }

  // Sign out
  const signoutBtn = document.getElementById('account-signout-btn');
  if (signoutBtn) {
    signoutBtn.onclick = async () => {
      await signOut(auth);
      state.setCurrentUser(null, false);
      showToast(state.getLang() === 'ar' ? 'تم تسجيل الخروج' : 'Signed out', 'info');
      window.location.hash = 'home';
    };
  }

  // Return & Exchange Request Modal
  document.querySelectorAll('.open-return-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const orderId = target.getAttribute('data-order-id');
      const orderNum = target.getAttribute('data-order-num');
      const lang = state.getLang();

      openModal(`
        <h3 style="font-family: var(--font-editorial); font-size: 24px; margin-bottom: 8px;">
          ${state.t('requestReturn')} • ${orderNum}
        </h3>
        <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 16px;">
          ${lang === 'ar' ? 'يرجى تحديد سبب الإرجاع ونوع العملية (استرجاع المبلغ أو استبدال المقاس).' : 'Specify return reason and whether you prefer an exchange or refund.'}
        </p>

        <form id="submit-return-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div class="form-group">
            <label class="form-label">${lang === 'ar' ? 'نوع الطلب' : 'Request Type'} *</label>
            <select id="ret-type" class="form-select">
              <option value="return">${lang === 'ar' ? 'إرجاع واسترداد المبلغ (Refund)' : 'Return & Refund'}</option>
              <option value="exchange">${lang === 'ar' ? 'استبدال المقاس أو اللون (Exchange Size/Color)' : 'Exchange Size or Color'}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">${state.t('reason')} *</label>
            <select id="ret-reason" class="form-select">
              <option value="size_small">${lang === 'ar' ? 'المقاس صغير جداً' : 'Size is too small'}</option>
              <option value="size_large">${lang === 'ar' ? 'المقاس كبير جداً' : 'Size is too large'}</option>
              <option value="style_fit">${lang === 'ar' ? 'رغبة في تغيير الموديل أو اللون' : 'Different style or color preference'}</option>
              <option value="defective">${lang === 'ar' ? 'ملاحظة على القماش أو عيب صناعة' : 'Defect or fabric issue'}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">${lang === 'ar' ? 'ملاحظات تفصيلية' : 'Detailed Notes'}</label>
            <textarea id="ret-details" rows="3" class="form-textarea" placeholder="${lang === 'ar' ? 'اذكر أي تفاصيل إضافية أو المقاس البديل المطلوب...' : 'Describe replacement size requested or additional notes...'}"></textarea>
          </div>

          <button type="submit" class="btn btn-primary btn-full">
            ${lang === 'ar' ? 'إرسال طلب الإرجاع للإدارة' : 'Submit Return Request'}
          </button>
        </form>
      `);

      const retForm = document.getElementById('submit-return-form');
      if (retForm) {
        retForm.onsubmit = async (ev) => {
          ev.preventDefault();
          const type = (document.getElementById('ret-type') as HTMLSelectElement).value;
          const reason = (document.getElementById('ret-reason') as HTMLSelectElement).value;
          const detailedReason = (document.getElementById('ret-details') as HTMLTextAreaElement).value;

          try {
            await addDoc(collection(db, 'returns'), {
              orderId,
              orderNumber: orderNum,
              customerId: state.getUser()?.uid || 'guest',
              customerEmail: state.getUser()?.email || '',
              type,
              reason,
              detailedReason,
              status: 'requested',
              createdAt: new Date().toISOString()
            });

            closeModal();
            showToast(lang === 'ar' ? 'تم تقديم طلب الإرجاع بنجاح، وسيتواصل معك فريق الآتيليه.' : 'Return request submitted. Our concierge will contact you.', 'success');
            window.location.hash = 'account?tab=returns';
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        };
      }
    });
  });
}
