import {getRequestConfig} from 'next-intl/server';
export default getRequestConfig(async({requestLocale})=>{const requested=await requestLocale;const locale=['ka','hy','ru','en'].includes(requested||'')?requested!:'ru';return {locale,timeZone:'Asia/Tbilisi',messages:(await import(`../../messages/${locale}.json`)).default};});
