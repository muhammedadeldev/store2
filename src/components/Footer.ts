import { state } from '../state';

export function renderFooter(): string {
  const lang = state.getLang();
  const settings = state.getSettings();
  const copy = (key: string, fallback: string) => state.getSiteText(key, fallback);
  const brandName = lang === 'ar' ? settings.brandNameAr || settings.brandName : settings.brandName;
  const tagline = lang === 'ar' ? settings.taglineAr || settings.tagline : settings.tagline;

  return `
    <footer class="site-footer" style="background-color: #121212; color: #a3a19d; padding-top: var(--space-4xl); padding-bottom: var(--space-2xl); border-top: 1px solid #292826;">
      <div class="container">
        <div class="footer-grid">
          
          <!-- Brand Info -->
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-md);">
              <img src="${settings.footerLogoUrl || '/assets/logo-icon-white.png'}" alt="${brandName}" style="height: 38px; width: auto;" />
              <h3 style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.08em; margin: 0;">
                ${brandName}
              </h3>
            </div>
            <p style="font-size: 14px; line-height: 1.8; color: #8c8984; max-width: 320px; margin-bottom: var(--space-lg);">
              ${copy(`footer.brandDescription.${lang}`, lang === 'ar' ? 'براند أزياء مصري عصري بخامات قطن مصري 100% وتصميمات عصرية راقية تجمع بين الراحة والفخامة اليومية.' : 'Contemporary Egyptian streetwear & fashion crafted from noble 100% Egyptian cotton fibers.')}
            </p>
            <div style="display: flex; gap: var(--space-sm); color: #ffffff;">
              <a href="${settings.socialInstagram}" target="_blank" rel="noopener" class="icon-btn" style="color: #ffffff; background: #222120;" title="Instagram">
                <i class="fa-brands fa-instagram" aria-hidden="true" style="font-size: 18px;"></i>
              </a>
              <a href="https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" class="icon-btn" style="color: #ffffff; background: #222120;" title="WhatsApp">
                <i class="fa-brands fa-whatsapp" aria-hidden="true" style="font-size: 18px;"></i>
              </a>
              <a href="${settings.socialFacebook}" target="_blank" rel="noopener" class="icon-btn" style="color:#ffffff;background:#222120;" title="Facebook"><i class="fa-brands fa-facebook-f" aria-hidden="true"></i></a>
              <a href="${settings.socialTiktok}" target="_blank" rel="noopener" class="icon-btn" style="color:#ffffff;background:#222120;" title="TikTok"><i class="fa-brands fa-tiktok" aria-hidden="true"></i></a>
            </div>
            <address style="font-size:12px;font-style:normal;line-height:1.8;margin-top:var(--space-md);color:#a3a19d;">
              ${settings.address ? `<div><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${settings.address}</div>` : ''}
              ${settings.contactPhone ? `<div><i class="fa-solid fa-phone" aria-hidden="true"></i> <a href="tel:${settings.contactPhone}" style="color:inherit;">${settings.contactPhone}</a></div>` : ''}
              ${settings.contactEmail ? `<div><i class="fa-solid fa-envelope" aria-hidden="true"></i> <a href="mailto:${settings.contactEmail}" style="color:inherit;">${settings.contactEmail}</a></div>` : ''}
            </address>
          </div>

          <!-- Quick Navigation -->
          <div>
            <h4 style="color: #ffffff; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: var(--space-md); font-weight: 700;">
              ${copy(`footer.collections.title.${lang}`, lang === 'ar' ? 'أقسام الكولكشن' : 'Collections')}
            </h4>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
              <li><a href="${copy('footer.collections.all.href', '#shop')}" style="color: #a3a19d;">${copy(`footer.collections.all.${lang}`, lang === 'ar' ? 'جميع المنتجات' : 'All Products')}</a></li>
              <li><a href="${copy('footer.collections.new.href', '#shop?filter=new')}" style="color: #a3a19d;">${copy(`footer.collections.new.${lang}`, state.t('newArrivals'))}</a></li>
              <li><a href="${copy('footer.collections.best.href', '#shop?filter=bestseller')}" style="color: #a3a19d;">${copy(`footer.collections.best.${lang}`, state.t('bestSellers'))}</a></li>
              <li><a href="${copy('footer.collections.one.href', '#shop')}" style="color: #a3a19d;">${copy(`footer.collections.one.${lang}`, lang === 'ar' ? 'هوديز وسويت شيرت' : 'Hoodies & Sweatshirts')}</a></li>
              <li><a href="${copy('footer.collections.two.href', '#shop')}" style="color: #a3a19d;">${copy(`footer.collections.two.${lang}`, lang === 'ar' ? 'تيشيرتات وبولو' : 'T-Shirts & Polos')}</a></li>
              <li><a href="${copy('footer.collections.three.href', '#shop')}" style="color: #a3a19d;">${copy(`footer.collections.three.${lang}`, lang === 'ar' ? 'بنطلونات وكارجو' : 'Pants & Cargo')}</a></li>
            </ul>
          </div>

          <!-- Client Care & Policies -->
          <div>
            <h4 style="color: #ffffff; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: var(--space-md); font-weight: 700;">
              ${copy(`footer.care.title.${lang}`, lang === 'ar' ? 'خدمة العملاء والسياسات' : 'Client Care')}
            </h4>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
              <li><a href="${copy('footer.care.track.href', '#track')}" style="color: #a3a19d;">${copy(`footer.care.track.${lang}`, state.t('trackOrder'))}</a></li>
              <li><a href="${copy('footer.care.size.href', '#page/size-guide')}" style="color: #a3a19d;">${copy(`footer.care.size.${lang}`, state.t('sizeGuide'))}</a></li>
              <li><a href="${copy('footer.care.shipping.href', '#page/shipping-policy')}" style="color: #a3a19d;">${copy(`footer.care.shipping.${lang}`, lang === 'ar' ? 'الشحن والتوصيل لجميع المحافظات' : 'Shipping in Egypt')}</a></li>
              <li><a href="${copy('footer.care.returns.href', '#page/returns-policy')}" style="color: #a3a19d;">${copy(`footer.care.returns.${lang}`, lang === 'ar' ? 'الاستبدال والاسترجاع (14 يوم)' : 'Returns & Exchange')}</a></li>
              <li><a href="${copy('footer.care.about.href', '#page/about')}" style="color: #a3a19d;">${copy(`footer.care.about.${lang}`, state.t('about'))}</a></li>
            </ul>
          </div>

          <!-- Newsletter & Concierge -->
          <div>
            <h4 style="color: #ffffff; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: var(--space-md); font-weight: 700;">
              ${copy(`footer.newsletter.title.${lang}`, lang === 'ar' ? 'انضم لنادي EIGHTY-EIGHT' : 'Join EIGHTY-EIGHT')}
            </h4>
            <p style="font-size: 13px; color: #8c8984; line-height: 1.6; margin-bottom: var(--space-md);">
              ${copy(`footer.newsletter.description.${lang}`, lang === 'ar' ? 'اشترك لتصلك أحدث القطع قبل نزولها وكوبونات خصم حصرية للأعضاء.' : 'Subscribe for exclusive runway drops, VIP discounts, and early access.')}
            </p>
            <form id="newsletter-form" style="display: flex; gap: var(--space-xs);">
              <input type="email" required placeholder="${copy(`footer.newsletter.placeholder.${lang}`, lang === 'ar' ? 'اكتب بريدك الإلكتروني...' : 'Your email address...')}" style="flex: 1; padding: 10px 14px; background: #1c1b1a; border: 1px solid #383633; color: #ffffff; font-size: 13px; border-radius: var(--radius-xs);" />
              <button type="submit" class="btn btn-gold btn-sm">${copy(`footer.newsletter.button.${lang}`, lang === 'ar' ? 'اشتراك' : 'Join')}</button>
            </form>
          </div>

        </div>

        <!-- Sub-footer with Copyright & Payment Badges -->
        <div style="padding-top: var(--space-xl); border-top: 1px solid #222120; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md); font-size: 13px; color: #8c8984;">
          <div>
            ${copy(`footer.copyright.${lang}`, lang === 'ar' ? `© ${new Date().getFullYear()} ${brandName}. جميع الحقوق محفوظة. براند أزياء مصري عصري مسجل.` : `© ${new Date().getFullYear()} ${brandName}. All rights reserved. Contemporary Egyptian Fashion Brand.`)}
          </div>
          <div style="display: flex; gap: var(--space-md); align-items: center; font-size: 12px;">
            <span>${copy(`footer.payment.cash.${lang}`, 'الدفع عند الاستلام كاش')}</span>
            <span>•</span>
            <span>${copy(`footer.payment.cards.${lang}`, 'فيزا وماستركارد')}</span>
            <span>•</span>
            <span>${copy(`footer.payment.wallets.${lang}`, 'فودافون كاش وإنستاباي InstaPay')}</span>
            <span>•</span>
            <span>${copy(`footer.payment.shipping.${lang}`, 'شحن لجميع محافظات مصر')}</span>
          </div>
        </div>
      </div>
    </footer>
  `;
}
