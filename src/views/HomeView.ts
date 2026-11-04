import { state } from '../state';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export async function renderHomeView(): Promise<string> {
  const lang = state.getLang();
  const settings = state.getSettings();
  const copy = (key: string, fallback: string) => state.getSiteText(key, fallback);
  const visible = (key: string) => settings.homeVisibility?.[key] !== false;

  // Fetch Categories & Featured Products from Firestore
  let categories: any[] = [];
  let newArrivals: any[] = [];
  let bestSellers: any[] = [];

  try {
    const catSnap = await getDocs(query(collection(db, 'categories'), where('isActive', '==', true), limit(6)));
    categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    const prodSnap = await getDocs(query(collection(db, 'products'), where('isPublished', '==', true), limit(8)));
    const allProds: any[] = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    newArrivals = allProds.filter(p => p.isNewArrival);
    bestSellers = allProds.filter(p => p.isBestSeller);
    if (newArrivals.length === 0) newArrivals = allProds.slice(0, 4);
    if (bestSellers.length === 0) bestSellers = allProds.slice(2, 6);
  } catch (e) {
    console.error('Error fetching home data', e);
  }

  const heroTitle = lang === 'ar' ? settings.heroTitleAr : settings.heroTitle;
  const heroSubtitle = lang === 'ar' ? settings.heroSubtitleAr : settings.heroSubtitle;
  const heroCtaText = lang === 'ar' ? settings.heroCtaTextAr : settings.heroCtaText;
  const heroSecondaryText = lang === 'ar' ? settings.heroCtaSecondaryTextAr : settings.heroCtaSecondaryText;

  return `
    <div class="home-page animate-fade-in">
      <!-- Hero Section -->
      ${visible('section.hero') ? `<section class="hero-section">
        ${visible('hero.background') ? `<picture class="hero-background" aria-hidden="true">
          ${settings.heroImageMobileUrl ? `<source media="(max-width: 767px)" srcset="${settings.heroImageMobileUrl}" />` : ''}
          <img src="${settings.heroImageUrl}" alt="" />
        </picture>` : ''}
        ${visible('hero.overlay') && settings.heroOverlayActive !== false ? '<div class="hero-overlay"></div>' : ''}
        <div class="container">
          <div class="hero-content">
            ${visible('hero.tagline') && settings.heroTaglineActive !== false ? `<span class="hero-tagline">${lang === 'ar' ? settings.heroTaglineAr : settings.heroTagline}</span>` : ''}
            ${visible('hero.title') && settings.heroTitleActive !== false ? `<h1 class="hero-title">${heroTitle}</h1>` : ''}
            ${visible('hero.subtitle') && settings.heroSubtitleActive !== false ? `<p class="hero-description">${heroSubtitle}</p>` : ''}
            <div class="hero-actions">
              ${visible('hero.primaryCta') && settings.heroCtaPrimaryActive !== false ? `<a href="${settings.heroCtaLink || '#shop'}" class="btn btn-lg hero-btn-primary">
                <span><i class="fa-solid fa-star" aria-hidden="true"></i></span>
                <span>${heroCtaText}</span>
              </a>` : ''}
              ${visible('hero.secondaryCta') && settings.heroCtaSecondaryActive !== false ? `<a href="${settings.heroCtaSecondaryLink || '#shop'}" class="btn btn-lg hero-btn-secondary">
                <span><i class="fa-solid fa-shirt" aria-hidden="true"></i></span>
                <span>${heroSecondaryText}</span>
              </a>` : ''}
            </div>
          </div>
        </div>
      </section>` : ''}

      <!-- Brand Pillars / Values -->
      ${visible('section.pillars') ? `<section class="pillars-section">
        <div class="container">
          <div class="pillars-grid">
            ${[1, 2, 3, 4].filter(i => visible(`pillars.item${i}`)).map(i => `
              <div style="display:flex;align-items:center;gap:var(--space-sm);">
                <span style="font-size:24px;color:var(--color-brand-gold);"><i class="fa-solid fa-star" aria-hidden="true"></i></span>
                <div>
                  <h4 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${copy(`home.pillar${i}.title.${lang}`, [lang === 'ar' ? 'خامات طبيعية نقية 100%' : 'Noble Fibers', lang === 'ar' ? 'حرفية آتيليه يدوية' : 'Atelier Craft', lang === 'ar' ? 'شحن سريع لجميع المحافظات' : 'Fast Express Across Egypt', lang === 'ar' ? 'إرجاع واستبدال مجاني' : '14-Day Returns'][i - 1])}</h4>
                  <p style="font-size:12px;color:var(--color-text-muted);">${copy(`home.pillar${i}.description.${lang}`, [lang === 'ar' ? 'كشمير منغولي وحرير التوت الإيطالي' : 'Mongolian cashmere & Mulberry silk', lang === 'ar' ? 'حياكة دقيقة وقصات باريسية متقنة' : 'Parisian cuts & artisanal finishing', lang === 'ar' ? 'توصيل مجاني للطلبات فوق 1,500 ج.م' : 'Free express on orders over 1,500 EGP', lang === 'ar' ? 'استبدال واسترجاع سلس بدون عناء' : 'Effortless courier pick-up'][i - 1])}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>` : ''}

      <!-- Featured Collections -->
      ${visible('section.collections') ? `<section style="padding: var(--space-4xl) 0;">
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-2xl);">
            <div>
              ${visible('collections.eyebrow') ? `<span style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: 4px;">${copy(`home.collections.eyebrow.${lang}`, lang === 'ar' ? 'المجموعات والتصنيفات' : 'The Curations')}</span>` : ''}
              ${visible('collections.title') ? `<h3 style="font-family: var(--font-editorial); font-size: clamp(28px, 4vw, 38px); font-weight: 500;">
                ${copy(`home.collections.title.${lang}`, lang === 'ar' ? 'المجموعات والتصنيفات الفاخرة' : 'Signature Collections')}
              </h3>` : ''}
            </div>
            ${visible('collections.link') ? `<a href="${copy('home.collections.link.href', '#shop')}" class="nav-link" style="font-size: 13px; font-weight: 600;">
              ${copy(`home.collections.link.${lang}`, lang === 'ar' ? 'عرض كل التصنيفات ←' : 'View All Collections →')}
            </a>` : ''}
          </div>

          ${visible('collections.grid') ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-lg);">
            ${categories.map(cat => `
              <a href="#shop?cat=${cat.id}" class="category-card" style="position: relative; aspect-ratio: 4/5; overflow: hidden; border-radius: var(--radius-xs); display: block; background: #222;">
                <img src="${cat.imageUrl}" alt="${cat.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'" />
                <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, transparent 100%);"></div>
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: var(--space-lg); color: #ffffff;">
                  <h3 style="font-family: var(--font-editorial); font-size: 22px; font-weight: 500; margin-bottom: 4px;">
                    ${lang === 'ar' ? (cat.nameAr || cat.name) : cat.name}
                  </h3>
                  ${visible('collections.discover') ? `<span style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #e2ded5; font-weight: 500;">
                    ${copy(`home.collections.discover.${lang}`, lang === 'ar' ? 'اكتشف القطع ←' : 'Discover Pieces →')}
                  </span>` : ''}
                </div>
              </a>
            `).join('')}
          </div>` : ''}
        </div>
      </section>` : ''}

      <!-- New Arrivals Grid -->
      ${visible('section.arrivals') ? `<section style="padding: var(--space-4xl) 0; background-color: var(--color-surface); border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border);">
        <div class="container">
          <div style="text-align: center; max-width: 600px; margin: 0 auto var(--space-3xl) auto;">
            ${visible('arrivals.eyebrow') ? `<span style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: 6px;">
              ${copy(`home.arrivals.eyebrow.${lang}`, lang === 'ar' ? 'إبداعات الموسم' : 'Runway Highlights')}
            </span>` : ''}
            ${visible('arrivals.title') ? `<h3 style="font-family: var(--font-editorial); font-size: clamp(30px, 4.5vw, 42px); font-weight: 500;">
              ${copy(`home.arrivals.title.${lang}`, state.t('newArrivals'))}
            </h3>` : ''}
            ${visible('arrivals.description') ? `<p style="font-size: 14px; color: var(--color-text-muted); margin-top: var(--space-xs);">
              ${copy(`home.arrivals.description.${lang}`, lang === 'ar' ? 'قطع حصرية محدودة الإصدار تم قصها وتفصيلها بأعلى معايير الهوت كوتور.' : 'Limited atelier pieces cut and hand-finished with timeless contemporary proportions.')}
            </p>` : ''}
          </div>

          ${visible('arrivals.products') ? `<div class="grid-products">
            ${newArrivals.map(prod => renderProductCard(prod, lang)).join('')}
          </div>` : ''}

          ${visible('arrivals.button') ? `<div style="text-align: center; margin-top: var(--space-3xl);">
            <a href="${copy('home.arrivals.link.href', '#shop')}" class="btn btn-secondary btn-lg">
              ${copy(`home.arrivals.link.${lang}`, lang === 'ar' ? 'استعراض كامل التشكيلة' : 'View Full Ready-to-Wear')}
            </a>
          </div>` : ''}
        </div>
      </section>` : ''}

      <!-- Editorial Atelier Story Banner -->
      ${visible('section.story') ? `<section style="position: relative; padding: var(--space-4xl) 0; background-color: #121212; color: #ffffff; overflow: hidden;">
        <div class="container" style="position: relative; z-index: 10;">
          <div class="story-grid" ${visible('story.image') ? '' : 'style="grid-template-columns:1fr;"'}>
            <div>
              ${visible('story.eyebrow') ? `<span style="font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: var(--space-sm);">
                ${copy(`home.story.eyebrow.${lang}`, lang === 'ar' ? 'فلسفة المتجر والإنتاج' : 'The Brand Craft')}
              </span>` : ''}
              ${visible('story.title') ? `<h3 style="font-family: var(--font-editorial); font-size: clamp(32px, 4.5vw, 48px); line-height: 1.15; font-weight: 400; margin-bottom: var(--space-lg);">
                ${copy(`home.story.title.${lang}`, lang === 'ar' ? 'خياطة معمارية دقيقة لا تعترف بمرور الزمن' : 'Sculptural Tailoring Built For A Lifetime')}
              </h3>` : ''}
              ${visible('story.body1') ? `<p style="font-size: 15px; line-height: 1.8; color: #b8b5af; margin-bottom: var(--space-md);">
                ${lang === 'ar' 
                  ? copy('home.story.body1.ar', 'في براند EIGHTY-EIGHT، نؤمن بأن الأناقة الحقيقية تنبع من نقاء القماش والقصة المثالية. نعتمد فقط على القطن المصري 100% الثقيل والمعالج لضمان الراحة التامة والمتانة الاستثنائية.')
                  : copy('home.story.body1.en', 'At EIGHTY-EIGHT, true streetwear luxury resides in the purity of proportion and the integrity of 100% premium Egyptian heavy cotton.')}
              </p>` : ''}
              ${visible('story.body2') ? `<p style="font-size: 14px; line-height: 1.8; color: #8c8984; margin-bottom: var(--space-xl);">
                ${lang === 'ar'
                  ? copy('home.story.body2.ar', 'كل تصميم يخضع لعشرات الساعات من التعديل اليدوي للتأكد من انسيابيته مع حركة الجسد.')
                  : copy('home.story.body2.en', 'Every piece undergoes rigorous hand draping and tailoring to guarantee an effortless fluid drape.')}
              </p>` : ''}
              ${visible('story.button') ? `<a href="${copy('home.story.link.href', '#page/about')}" class="btn btn-gold btn-sm">
                ${copy(`home.story.link.${lang}`, lang === 'ar' ? 'قراءة قصة المتجر الكاملة' : 'Read Store Story')}
              </a>` : ''}
            </div>

            ${visible('story.image') ? `<div style="position: relative;">
              <img src="${copy('home.story.image', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85')}" alt="${copy(`home.story.imageAlt.${lang}`, lang === 'ar' ? 'قصة وحرفية البراند' : 'Atelier Craft')}" style="width: 100%; border-radius: var(--radius-xs); box-shadow: var(--shadow-lg);" />
            </div>` : ''}
          </div>
        </div>
      </section>` : ''}

      <!-- Best Sellers Grid -->
      ${visible('section.bestsellers') ? `<section style="padding: var(--space-4xl) 0;">
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-2xl);">
            <div>
              ${visible('bestsellers.eyebrow') ? `<span style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-brand-gold); display: block; margin-bottom: 4px;">${copy(`home.bestsellers.eyebrow.${lang}`, lang === 'ar' ? 'القطع الأيقونية' : 'The Icons')}</span>` : ''}
              ${visible('bestsellers.title') ? `<h3 style="font-family: var(--font-editorial); font-size: clamp(28px, 4vw, 38px); font-weight: 500;">
                ${copy(`home.bestsellers.title.${lang}`, state.t('bestSellers'))}
              </h3>` : ''}
            </div>
            ${visible('bestsellers.link') ? `<a href="${copy('home.bestsellers.link.href', '#shop?filter=bestseller')}" class="nav-link" style="font-size: 13px; font-weight: 600;">
              ${copy(`home.bestsellers.link.${lang}`, lang === 'ar' ? 'عرض الأكثر طلباً ←' : 'View All Best Sellers →')}
            </a>` : ''}
          </div>

          ${visible('bestsellers.products') ? `<div class="grid-products">
            ${bestSellers.map(prod => renderProductCard(prod, lang)).join('')}
          </div>` : ''}
        </div>
      </section>` : ''}

      <!-- Instagram / Runway Gallery -->
      ${visible('section.social') ? `<section style="padding: var(--space-3xl) 0; background-color: var(--color-surface); border-top: 1px solid var(--color-border);">
        <div class="container">
          <div style="text-align: center; margin-bottom: var(--space-2xl);">
            ${visible('social.handle') ? `<span style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-brand-gold); display: block;">${copy('home.social.handle', '@letoile_official')}</span>` : ''}
            ${visible('social.title') ? `<h3 style="font-family: var(--font-editorial); font-size: 28px; font-weight: 500;">${copy(`home.social.title.${lang}`, lang === 'ar' ? 'إطلالات الكوتور في العالم' : 'Worn Across The Globe')}</h3>` : ''}
          </div>

          <div class="insta-grid">
            ${[1, 2, 3, 4, 5].filter(i => visible(`social.image${i}`)).map(i => `<img src="${copy(`home.social.image.${i}`, [
              'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1548624149-f9b1859aa9d0?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80'
            ][i - 1])}" alt="${copy(`home.story.imageAlt.${lang}`, lang === 'ar' ? `إطلالة ${i}` : `Runway look ${i}`)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-xs);" />`).join('')}
          </div>
        </div>
      </section>` : ''}
    </div>
  `;
}

// Reusable Product Card Component
export function renderProductCard(prod: any, lang: 'ar' | 'en'): string {
  const title = lang === 'ar' ? (prod.nameAr || prod.name) : prod.name;
  const isSale = prod.salePrice && prod.salePrice > 0;
  const displayPrice = isSale ? prod.salePrice : prod.price;
  const originalPrice = isSale ? prod.price : null;
  const primaryImg = (prod.images && prod.images[0]) || '';
  const secondaryImg = (prod.images && prod.images[1]) || primaryImg;

  return `
    <div class="product-card" data-id="${prod.id}">
      <div class="product-image-wrap">
        <a href="#product?id=${prod.id}">
          <img src="${primaryImg}" alt="${title}" class="product-image" loading="lazy" />
        </a>

        ${isSale ? '<span class="product-badge sale">Sale</span>' : ''}
        ${!isSale && prod.isNewArrival ? `<span class="product-badge">${lang === 'ar' ? 'جديد' : 'New'}</span>` : ''}

        <div class="quick-action-overlay">
          <a href="#product?id=${prod.id}" class="btn btn-primary btn-sm btn-full" style="font-size: 11px;">
            ${lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
          </a>
        </div>
      </div>

      <div class="product-info">
        <span class="product-category">${prod.categoryName || 'Haute Couture'}</span>
        <a href="#product?id=${prod.id}">
          <h3 class="product-title">${title}</h3>
        </a>
        
        <div class="product-price-row">
          <span class="price-current">${state.formatPrice(displayPrice)}</span>
          ${originalPrice ? `<span class="price-original">${state.formatPrice(originalPrice)}</span>` : ''}
        </div>

        ${prod.colors && prod.colors.length > 0 ? `
          <div class="product-colors-dots">
            ${prod.colors.map((c: any) => `
              <span class="color-dot" style="background-color: ${c.hex};" title="${lang === 'ar' ? (c.nameAr || c.name) : c.name}"></span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
