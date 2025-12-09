import faMessages from '../locales/fa.json';
import enMessages from '../locales/en.json';
import arMessages from '../locales/ar.json';
import urMessages from '../locales/ur.json';

const localeMessages = {
  fa: faMessages,
  en: enMessages,
  ar: arMessages,
  ur: urMessages
};

export const getLanguageName = (languageCode) => {
  const normalizedCode = languageCode?.toLowerCase?.();

  if (!normalizedCode) {
    return '';
  }

  const messages = localeMessages[normalizedCode];

  if (!messages) {
    return normalizedCode;
  }

  return messages[normalizedCode] || normalizedCode;
};

export default getLanguageName;
