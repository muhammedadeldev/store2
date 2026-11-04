import { state } from '../state';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export async function renderPageView(slug: string): Promise<string> {
  const lang = state.getLang();
  const copy = (key: string, fallback: string) => state.getSiteText(key, fallback);
  const settings = state.getSettings();
  const configuredWhatsapp = copy('page.whatsappButton.href', 'whatsapp');
  const whatsappHref = configuredWhatsapp === 'whatsapp'
    ? `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`
    : configuredWhatsapp;

  let pageData: any = null;
  try {
    const q = query(collection(db, 'pages'), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const storedPage = snap.docs[0].data();
      if (storedPage.isPublished !== false) pageData = storedPage;
    }
  } catch (e) {
    console.error('Error fetching CMS page', e);
  }

  if (!pageData) {
    // Default fallback content for essential pages
    if (slug === 'about') {
      pageData = {
        title: copy('page.about.title.en', 'The EIGHTY-EIGHT Story'),
        titleAr: copy('page.about.title.ar', 'قصة المتجر والحرفية'),
        content: copy('page.about.content.en', 'Founded with an uncompromising devotion to fabric integrity and architectural silhouettes, EIGHTY-EIGHT represents modern Egyptian streetwear elevated to luxury standards. Every garment is crafted from 100% combed heavy Egyptian cotton, engineered for lasting comfort and durability.'),
        contentAr: copy('page.about.content.ar', 'تأسس متجر EIGHTY-EIGHT انطلاقاً من شغف استثنائي بنقاء خامات القطن المصري 100% ودقة الخطوط التصميمية لتصل بالستريت وير المصري إلى أعلى معايير الجودة العالمية. بنصمم كل قطعة بعناية فائقة لتجمع بين الفخامة والراحة والأناقة اليومية مع تقفيل دقيق يدوم طويلاً.')
      };
    } else {
      return `
        <div class="container" style="padding: 100px 0; text-align: center;">
          <h3 style="font-family: var(--font-editorial); font-size: 32px; margin-bottom: 16px;">${copy(`page.notFound.${lang}`, lang === 'ar' ? 'الصفحة غير موجودة' : 'Page Not Found')}</h3>
          <a href="#home" class="btn btn-primary">${state.t('home')}</a>
        </div>
      `;
    }
  }

  const title = lang === 'ar' ? (pageData.titleAr || pageData.title) : pageData.title;
  const content = lang === 'ar' ? (pageData.contentAr || pageData.content) : pageData.content;

  return `
    <div class="cms-page container animate-fade-in" style="padding-top: var(--space-3xl); padding-bottom: var(--space-4xl); max-width: 860px;">
      <div style="text-align: center; margin-bottom: var(--space-3xl); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2xl);">
        <span style="font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--color-brand-primary); display: block; margin-bottom: 6px; font-weight: 700;">
          ${copy(`page.heading.${lang}`, lang === 'ar' ? 'صفحات ومعلومات المتجر' : 'Store Documentation')}
        </span>
        <h1 style="font-family: var(--font-editorial); font-size: clamp(32px, 5vw, 48px); font-weight: 500;">
          ${title}
        </h1>
      </div>

      <div style="font-size: 16px; line-height: 2; color: var(--color-text-main); font-weight: 400;">
        <p style="margin-bottom: var(--space-xl); white-space: pre-line;">${content}</p>
      </div>

      <div style="margin-top: var(--space-4xl); border-top: 1px solid var(--color-border); padding-top: var(--space-xl); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <a href="${copy('page.shopButton.href', '#shop')}" class="btn btn-primary btn-sm">
          ${copy(`page.shopButton.${lang}`, lang === 'ar' ? 'استعراض تشكيلة المتجر' : 'Explore Current Collection')}
        </a>
        <a href="${whatsappHref}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">
          <i class="fa-solid fa-comment" aria-hidden="true"></i> ${copy(`page.whatsappButton.${lang}`, lang === 'ar' ? 'محادثة خدمة عملاء المتجر (واتساب)' : 'Chat with Store Support (WhatsApp)')}
        </a>
      </div>
    </div>
  `;
}
