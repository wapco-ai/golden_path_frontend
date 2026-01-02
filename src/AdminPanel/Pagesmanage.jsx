// src/pages/PagesManage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import '../AdminPanel/Amain.css';
import adminPagesService from '../services/adminPagesService';

const PAGE_TYPES = ['support', 'rules', 'about', 'contact'];
const EMPTY_TRANSLATIONS = {
  englishDescription: '',
  arabicDescription: '',
  urduDescription: ''
};
const EMPTY_ADDRESS_TRANSLATIONS = {
  englishAddress: '',
  arabicAddress: '',
  urduAddress: ''
};
const EMPTY_FAQ_TRANSLATIONS = {
  englishQuestion: '',
  arabicQuestion: '',
  urduQuestion: '',
  englishAnswer: '',
  arabicAnswer: '',
  urduAnswer: ''
};

const normalizeTranslations = (translations) => ({
  ...EMPTY_TRANSLATIONS,
  ...(translations || {})
});

const normalizeAddressTranslations = (translations) => ({
  ...EMPTY_ADDRESS_TRANSLATIONS,
  ...(translations || {})
});

const normalizeFaqItem = (faq) => ({
  ...EMPTY_FAQ_TRANSLATIONS,
  ...faq
});

const PagesManage = () => {
  // State for modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [currentPageToEdit, setCurrentPageToEdit] = useState(null);
  const [modalData, setModalData] = useState({
    title: '',
    phones: [''],
    emails: [''],
    address: '',
    description: ''
  });
  const [faqs, setFaqs] = useState([]);
  const [newFAQ, setNewFAQ] = useState({ question: '', answer: '' });
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [currentFieldForLanguage, setCurrentFieldForLanguage] = useState(null);
  const [currentLanguageData, setCurrentLanguageData] = useState({
    english: '',
    arabic: '',
    urdu: ''
  });
  const [currentFAQIndex, setCurrentFAQIndex] = useState(null);

  const initialPages = useMemo(
    () => [
      {
        id: 1,
        title: 'پشتیبانی',
        description: '',
        type: 'support',
        createdAt: '۱۸ مرداد ۱۴۰۴'
      },
      {
        id: 2,
        title: 'سوالات متداول',
        description: '',
        type: 'faq',
        createdAt: '۲۰ مرداد ۱۴۰۴'
      },
      {
        id: 3,
        title: 'قوانین و مقررات',
        description: '',
        type: 'rules',
        createdAt: '۲۲ مرداد ۱۴۰۴'
      },
      {
        id: 4,
        title: 'درباره ما',
        description: '',
        type: 'about',
        createdAt: '۲۵ مرداد ۱۴۰۴'
      },
      {
        id: 5,
        title: 'تماس با ما',
        description: '',
        type: 'contact',
        createdAt: '۲۷ مرداد ۱۴۰۴'
      }
    ],
    []
  );

  // Initialize pages in useState with empty descriptions
  const [pages, setPages] = useState(initialPages);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  const handleEditClick = (page) => {
    setCurrentPageToEdit(page.type);


    const pageData = pages.find(p => p.id === page.id);

    switch (page.type) {
      case 'support':
        setModalData({
          title: page.title,
          description: pageData?.description || '',
          phones: pageData?.phones || [''],
          emails: pageData?.emails || ['']
        });
        break;
      case 'faq':
        setModalData({
          title: page.title,
          description: pageData?.description || ''
        });
        setNewFAQ({ question: '', answer: '' });
        break;
      case 'rules':
        setModalData({
          title: page.title,
          description: pageData?.description || ''
        });
        break;
      case 'about':
        setModalData({
          title: page.title,
          description: pageData?.description || ''
        });
        break;
      case 'contact':
        setModalData({
          title: page.title,
          description: pageData?.description || '',
          phones: pageData?.phones || [''],
          emails: pageData?.emails || [''],
          address: pageData?.address || ''
        });
        break;
      default:
        setModalData({
          title: page.title,
          description: pageData?.description || ''
        });
    }

    setIsModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;

    const loadPagesData = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const results = await Promise.all(
          PAGE_TYPES.map((type) => adminPagesService.getPage(type))
        );

        const nextPages = initialPages.map((page) => {
          const pageResponse = results.find((item) => item?.type === page.type);
          if (!pageResponse) return page;

          const translations = normalizeTranslations(pageResponse.translations);
          const addressTranslations = normalizeAddressTranslations(
            pageResponse.addressTranslations
          );

          return {
            ...page,
            description: pageResponse.description || '',
            phones: pageResponse.phones || [''],
            emails: pageResponse.emails || [''],
            address: pageResponse.address || '',
            englishDescription: translations.englishDescription,
            arabicDescription: translations.arabicDescription,
            urduDescription: translations.urduDescription,
            englishAddress: addressTranslations.englishAddress,
            arabicAddress: addressTranslations.arabicAddress,
            urduAddress: addressTranslations.urduAddress
          };
        });

        if (isMounted) {
          setPages(nextPages);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError('دریافت اطلاعات صفحات با خطا مواجه شد.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const loadFaqs = async () => {
      try {
        const response = await adminPagesService.listFaqs();
        const items = (response?.items || []).map((faq) => normalizeFaqItem(faq));

        if (isMounted) {
          setFaqs(items);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError('دریافت سوالات متداول با خطا مواجه شد.');
        }
      }
    };

    loadPagesData();
    loadFaqs();

    return () => {
      isMounted = false;
    };
  }, [initialPages]);

  // Handle add FAQ
  const handleAddFAQ = () => {
    if (newFAQ.question.trim() && newFAQ.answer.trim()) {
      const newFAQWithLanguages = normalizeFaqItem(newFAQ);

      const createFaq = async () => {
        setIsSaving(true);
        try {
          const createdFaq = await adminPagesService.createFaq(newFAQWithLanguages);
          const normalizedFaq = normalizeFaqItem(createdFaq);
          setFaqs((prevFaqs) => [...prevFaqs, normalizedFaq]);
          setNewFAQ({
            question: '',
            answer: '',
            englishQuestion: '',
            arabicQuestion: '',
            urduQuestion: '',
            englishAnswer: '',
            arabicAnswer: '',
            urduAnswer: ''
          });
          setIsFAQModalOpen(false);
        } catch (error) {
          alert('ذخیره سوال جدید با خطا مواجه شد.');
        } finally {
          setIsSaving(false);
        }
      };

      createFaq();
    }
  };


  const handleRemoveFAQ = (id) => {
    const removeFaq = async () => {
      setIsSaving(true);
      try {
        await adminPagesService.deleteFaq(id);
        setFaqs((prevFaqs) => prevFaqs.filter(faq => faq.id !== id));
      } catch (error) {
        alert('حذف سوال با خطا مواجه شد.');
      } finally {
        setIsSaving(false);
      }
    };

    removeFaq();
  };

  const handleSaveModal = () => {
    if (currentPageToEdit === 'faq') {
      return;
    }

    const payload = {
      description: modalData.description || '',
      englishDescription: modalData.englishDescription || '',
      arabicDescription: modalData.arabicDescription || '',
      urduDescription: modalData.urduDescription || ''
    };

    if (currentPageToEdit === 'support') {
      payload.phones = modalData.phones || [''];
      payload.emails = modalData.emails || [''];
    }

    if (currentPageToEdit === 'contact') {
      payload.phones = modalData.phones || [''];
      payload.emails = modalData.emails || [''];
      payload.address = modalData.address || '';
      payload.englishAddress = modalData.englishAddress || '';
      payload.arabicAddress = modalData.arabicAddress || '';
      payload.urduAddress = modalData.urduAddress || '';
    }

    const savePage = async () => {
      setIsSaving(true);
      try {
        const response = await adminPagesService.updatePage(currentPageToEdit, payload);
        const translations = normalizeTranslations(response?.translations);
        const addressTranslations = normalizeAddressTranslations(response?.addressTranslations);

        setPages((prevPages) =>
          prevPages.map((page) => {
            if (page.type !== currentPageToEdit) return page;

            return {
              ...page,
              description: response?.description || payload.description || '',
              phones: response?.phones || payload.phones || page.phones || [''],
              emails: response?.emails || payload.emails || page.emails || [''],
              address: response?.address || payload.address || page.address || '',
              englishDescription: translations.englishDescription,
              arabicDescription: translations.arabicDescription,
              urduDescription: translations.urduDescription,
              englishAddress: addressTranslations.englishAddress,
              arabicAddress: addressTranslations.arabicAddress,
              urduAddress: addressTranslations.urduAddress
            };
          })
        );

        alert(`تغییرات صفحه ${modalData.title} ذخیره شد`);
        setIsModalOpen(false);
        setCurrentPageToEdit(null);
      } catch (error) {
        alert('ذخیره تغییرات با خطا مواجه شد.');
      } finally {
        setIsSaving(false);
      }
    };

    savePage();
  };

  // Handle modal close
  const handleCloseModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setCurrentPageToEdit(null);
  };

  // Handle FAQ modal close
  const handleCloseFAQModal = () => {
    if (isSaving) return;
    setIsFAQModalOpen(false);
    setNewFAQ({ question: '', answer: '' });
  };

  // Render modal content based on page type
  const renderModalContent = () => {
    switch (currentPageToEdit) {
      case 'support':
        return (
          <div className="modal-content">
            {/* Title - Not Editable */}
            <div className="form-group">
              <label className="form-label">عنوان صفحه</label>
              <input
                type="text"
                className="form-input-pages disabled-input"
                value={modalData.title}
                readOnly
              />
            </div>

            {/* Phone Numbers Section */}
            <div className="form-group">
              <div className="form-label-with-button">
                <label className="form-label">شماره تماس پشتیبانی</label>
                <button
                  className="add-field-btn"
                  onClick={() => {
                    if (modalData.phones && modalData.phones.length < 3) {
                      setModalData({
                        ...modalData,
                        phones: [...(modalData.phones || []), '']
                      });
                    }
                  }}
                  disabled={modalData.phones && modalData.phones.length >= 3}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="#139B3C" />
                  </svg>
                </button>
              </div>

              {(modalData.phones || ['']).map((phone, index) => (
                <div key={index} className="field-with-remove">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="شماره تلفن"
                    value={phone}
                    onChange={(e) => {
                      const newPhones = [...(modalData.phones || [''])];
                      newPhones[index] = e.target.value;
                      setModalData({ ...modalData, phones: newPhones });
                    }}
                  />
                  {index > 0 && (
                    <button
                      className="remove-field-btn"
                      onClick={() => {
                        const newPhones = [...(modalData.phones || [''])];
                        newPhones.splice(index, 1);
                        setModalData({ ...modalData, phones: newPhones });
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                        <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Email Addresses Section */}
            <div className="form-group">
              <div className="form-label-with-button">
                <label className="form-label"> ایمیل پشتیبانی</label>
                <button
                  className="add-field-btn"
                  onClick={() => {
                    if (modalData.emails && modalData.emails.length < 3) {
                      setModalData({
                        ...modalData,
                        emails: [...(modalData.emails || []), '']
                      });
                    }
                  }}
                  disabled={modalData.emails && modalData.emails.length >= 3}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="#139B3C" />
                  </svg>
                </button>
              </div>

              {(modalData.emails || ['']).map((email, index) => (
                <div key={index} className="field-with-remove">
                  <input
                    type="email"
                    className="form-input"
                    placeholder="آدرس ایمیل"
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...(modalData.emails || [''])];
                      newEmails[index] = e.target.value;
                      setModalData({ ...modalData, emails: newEmails });
                    }}
                  />
                  {index > 0 && (
                    <button
                      className="remove-field-btn"
                      onClick={() => {
                        const newEmails = [...(modalData.emails || [''])];
                        newEmails.splice(index, 1);
                        setModalData({ ...modalData, emails: newEmails });
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                        <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="modal-content">
            {/* Title - Not Editable */}
            <div className="form-group">
              <label className="form-label">عنوان صفحه</label>
              <input
                type="text"
                className="form-input-faqs disabled-input"
                value={modalData.title}
                readOnly
              />
            </div>

            {/* FAQs List */}
            <div className="form-group">
              <div className="form-label-with-button-faqs">
                <label className="form-label">سوالات متداول</label>
                <button
                  className="add-faq-btn"
                  onClick={() => setIsFAQModalOpen(true)}
                >
                  <span>افزودن سوال جدید</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="#139B3C" />
                  </svg>
                </button>
              </div>

              {/* Existing FAQs */}
              {faqs.map((faq, index) => (
                // In the FAQ list display, update to show language button:
                <div className="faq-item">
                  <div className="faq-header">
                    <h4>عنوان سوال {index + 1}</h4>
                    <div className="faq-actions">
                      <button
                        className="remove-faq-btn"
                        onClick={() => handleRemoveFAQ(faq.id)}
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                          <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                        </svg>
                      </button>
                      <button
                        className="language-faq-btn"
                        onClick={() => {
                          setCurrentFAQIndex(index);
                          setCurrentFieldForLanguage('faq-question');
                          setCurrentLanguageData({
                            english: faq.englishQuestion || '',
                            arabic: faq.arabicQuestion || '',
                            urdu: faq.urduQuestion || ''
                          });
                          setIsLanguageModalOpen(true);
                        }}
                        title="ویرایش سوال به زبان‌های دیگر"
                      >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="faq-question">
                    <p> عنوان سوال {index + 1} :</p> {faq.question}
                  </div>
                  <div className="faq-answer">
                    <p> پاسخ سوال {index + 1} :</p> {faq.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'rules':
        return (
          <div className="modal-content">
            {/* Title - Not Editable */}
            <div className="form-group">
              <label className="form-label">عنوان صفحه</label>
              <input
                type="text"
                className="form-input-pages disabled-input"
                value={modalData.title}
                readOnly
              />
            </div>

            {/* Description with Language Button */}
            <div className="form-group">
              <label className="form-label">توضیحات قوانین و مقررات</label>
              <div className="textarea-with-language-btn">
                <textarea
                  className="form-textarea"
                  value={modalData.description}
                  onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                  rows={8}
                  placeholder="توضیحات کامل قوانین و مقررات استفاده از نرم‌افزار را وارد کنید"
                />
                <button
                  className="pages-language-input-btn"
                  type="button"
                  onClick={() => {
                    setCurrentFieldForLanguage('rules-description');
                    setCurrentLanguageData({
                      english: modalData.englishDescription || '',
                      arabic: modalData.arabicDescription || '',
                      urdu: modalData.urduDescription || ''
                    });
                    setIsLanguageModalOpen(true);
                  }}
                  title="ورود توضیحات به زبان‌های دیگر"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="modal-content">
            {/* Title - Not Editable */}
            <div className="form-group">
              <label className="form-label">عنوان صفحه</label>
              <input
                type="text"
                className="form-input-pages disabled-input"
                value={modalData.title}
                readOnly
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">توضیحات درباره ما</label>
              <div className="textarea-with-language-btn">
                <textarea
                  className="form-textarea"
                  value={modalData.description}
                  onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                  rows={8}
                  placeholder="توضیحات درباره شرکت، تیم توسعه و خدمات"
                />
                <button
                  className="pages-language-input-btn"
                  type="button"
                  onClick={() => {
                    setCurrentFieldForLanguage('about-description');
                    setCurrentLanguageData({
                      english: modalData.englishDescription || '',
                      arabic: modalData.arabicDescription || '',
                      urdu: modalData.urduDescription || ''
                    });
                    setIsLanguageModalOpen(true);
                  }}
                  title="ورود توضیحات به زبان‌های دیگر"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="modal-content">
            {/* Title - Not Editable */}
            <div className="form-group">
              <label className="form-label">عنوان صفحه</label>
              <input
                type="text"
                className="form-input-pages disabled-input"
                value={modalData.title}
                readOnly
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">توضیحات </label>
              <div className="textarea-with-language-btn">
                <textarea
                  className="form-textarea"
                  value={modalData.description}
                  onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                  rows={4}
                  placeholder="توضیحات خودتان را بنویسید ..."
                />
                <button
                  className="pages-language-input-btn"
                  type="button"
                  onClick={() => {
                    setCurrentFieldForLanguage('contact-description');
                    setCurrentLanguageData({
                      english: modalData.englishDescription || '',
                      arabic: modalData.arabicDescription || '',
                      urdu: modalData.urduDescription || ''
                    });
                    setIsLanguageModalOpen(true);
                  }}
                  title="ورود توضیحات به زبان‌های دیگر"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Phone Numbers Section */}
            <div className="form-group">
              <div className="form-label-with-button">
                <label className="form-label">شماره تلفن‌های تماس</label>
                <button
                  className="add-field-btn"
                  onClick={() => {
                    if (modalData.phones && modalData.phones.length < 3) {
                      setModalData({
                        ...modalData,
                        phones: [...(modalData.phones || []), '']
                      });
                    }
                  }}
                  disabled={modalData.phones && modalData.phones.length >= 3}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="#139B3C" />
                  </svg>
                </button>
              </div>

              {(modalData.phones || ['']).map((phone, index) => (
                <div key={index} className="field-with-remove">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="شماره تلفن"
                    value={phone}
                    onChange={(e) => {
                      const newPhones = [...(modalData.phones || [''])];
                      newPhones[index] = e.target.value;
                      setModalData({ ...modalData, phones: newPhones });
                    }}
                  />
                  {index > 0 && (
                    <button
                      className="remove-field-btn"
                      onClick={() => {
                        const newPhones = [...(modalData.phones || [''])];
                        newPhones.splice(index, 1);
                        setModalData({ ...modalData, phones: newPhones });
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                        <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Email Addresses Section */}
            <div className="form-group">
              <div className="form-label-with-button">
                <label className="form-label">آدرس‌های ایمیل تماس</label>
                <button
                  className="add-field-btn"
                  onClick={() => {
                    if (modalData.emails && modalData.emails.length < 3) {
                      setModalData({
                        ...modalData,
                        emails: [...(modalData.emails || []), '']
                      });
                    }
                  }}
                  disabled={modalData.emails && modalData.emails.length >= 3}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="#139B3C" />
                  </svg>
                </button>
              </div>

              {(modalData.emails || ['']).map((email, index) => (
                <div key={index} className="field-with-remove">
                  <input
                    type="email"
                    className="form-input"
                    placeholder="آدرس ایمیل"
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...(modalData.emails || [''])];
                      newEmails[index] = e.target.value;
                      setModalData({ ...modalData, emails: newEmails });
                    }}
                  />
                  {index > 0 && (
                    <button
                      className="remove-field-btn"
                      onClick={() => {
                        const newEmails = [...(modalData.emails || [''])];
                        newEmails.splice(index, 1);
                        setModalData({ ...modalData, emails: newEmails });
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.45597 18.3333H10.13C12.4489 18.3333 13.6084 18.3333 14.3622 17.578C15.1161 16.8227 15.1932 15.5837 15.3475 13.1058L15.5697 9.53534C15.6534 8.19086 15.6953 7.51861 15.3171 7.09262C14.9389 6.66663 14.3002 6.66663 13.0229 6.66663H6.56301C5.28569 6.66663 4.64704 6.66663 4.26885 7.09262C3.89065 7.51861 3.9325 8.19086 4.0162 9.53535L4.23846 13.1058C4.39272 15.5837 4.46984 16.8227 5.22371 17.578C5.97758 18.3333 7.13704 18.3333 9.45597 18.3333Z" fill="#EA4335" />
                        <path d="M2.29297 5.13885C2.29297 4.75533 2.58079 4.44442 2.93583 4.44442L5.15603 4.44404C5.59716 4.43197 5.98632 4.12897 6.13642 3.68072C6.14037 3.66893 6.1449 3.6544 6.16118 3.60165L6.25685 3.29157C6.31539 3.10145 6.36639 2.93581 6.43776 2.78776C6.71971 2.20287 7.24137 1.79671 7.84419 1.69273C7.99678 1.6664 8.15837 1.66652 8.34385 1.66664H11.2422C11.4277 1.66652 11.5893 1.6664 11.7419 1.69273C12.3447 1.79671 12.8664 2.20287 13.1483 2.78776C13.2197 2.93581 13.2707 3.10145 13.3292 3.29157L13.4249 3.60165C13.4412 3.6544 13.4457 3.66893 13.4497 3.68072C13.5998 4.12897 14.0661 4.43234 14.5073 4.44442H16.6501C17.0052 4.44442 17.293 4.75533 17.293 5.13885C17.293 5.52238 17.0052 5.83329 16.6501 5.83329H2.93583C2.58079 5.83329 2.29297 5.52238 2.29297 5.13885Z" fill="#EA4335" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Address Section */}
            <div className="form-group">
              <label className="form-label">آدرس</label>
              <div className="textarea-with-language-btn">
                <textarea
                  className="form-textarea"
                  value={modalData.address}
                  onChange={(e) => setModalData({ ...modalData, address: e.target.value })}
                  rows={3}
                  placeholder="آدرس خودتان را بنویسید"
                />
                <button
                  className="pages-language-input-btn"
                  type="button"
                  onClick={() => {
                    setCurrentFieldForLanguage('contact-address');
                    setCurrentLanguageData({
                      english: modalData.englishAddress || '',
                      arabic: modalData.arabicAddress || '',
                      urdu: modalData.urduAddress || ''
                    });
                    setIsLanguageModalOpen(true);
                  }}
                  title="ورود آدرس به زبان‌های دیگر"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pages-manage-container">
      {/* Page Title */}
      <div className="reports-section">
        <div className="report-header">
          <h4 className="report-title">مدیریت صفحات ایجاد شده مربوط به نرم‌افزار در اپلیکیشن</h4>
        </div>
        {loadError && (
          <div className="no-description">{loadError}</div>
        )}

        {/* Table*/}
        <div className="pages-table-container">
          <table className="pages-table">
            <thead>
              <tr>
                <th>عنوان صفحه</th>
                <th>توضیحات</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
      {pages.map((page) => (
                <tr key={page.id}>
                  <td>
                    <div className="pages-title-cell">
                      <div className="pages-title-text">
                        <strong>{page.title}</strong>
                      </div>
                    </div>
                  </td>
                  <td className="pages-description-cell">
                    {page.description ? (
                      <div className="truncated-description">
                        {page.description.split(/\s+/).slice(0, 4).join(' ')}
                        {page.description.split(/\s+/).length > 4 && '...'}
                      </div>
                    ) : (
                      <span className="no-description">بدون توضیح</span>
                    )}
                  </td>
                  <td>
                    <div className="pages-actions">
                      <button
                        className={getEditButtonClass(page.type)}
                        title="ویرایش"
                        onClick={() => handleEditClick(page)}
                        disabled={isLoading}
                      >
                        ویرایش
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <g clipPath="url(#clip0_367_7217)">
                            <path fillRule="evenodd" clipRule="evenodd" d="M7.96167 0.833374L8.99992 0.833374C9.27606 0.833374 9.49992 1.05723 9.49992 1.33337C9.49992 1.60952 9.27606 1.83337 8.99992 1.83337H7.99992C6.41444 1.83337 5.27562 1.83444 4.40897 1.95095C3.5567 2.06554 3.04289 2.28347 2.66312 2.66324C2.28335 3.04301 2.06542 3.55682 1.95083 4.40909C1.83431 5.27574 1.83325 6.41456 1.83325 8.00004C1.83325 9.58552 1.83431 10.7243 1.95083 11.591C2.06542 12.4433 2.28335 12.9571 2.66312 13.3368C3.04289 13.7166 3.5567 13.9345 4.40897 14.0491C5.27562 14.1656 6.41444 14.1667 7.99992 14.1667C9.5854 14.1667 10.7242 14.1656 11.5909 14.0491C12.4431 13.9345 12.957 13.7166 13.3367 13.3368C13.7165 12.9571 13.9344 12.4433 14.049 11.591C14.1655 10.7243 14.1666 9.58552 14.1666 8.00004V7.00004C14.1666 6.7239 14.3904 6.50004 14.6666 6.50004C14.9427 6.50004 15.1666 6.7239 15.1666 7.00004V8.03829C15.1666 9.57722 15.1666 10.7832 15.0401 11.7242C14.9106 12.6874 14.6404 13.4474 14.0438 14.044C13.4473 14.6405 12.6873 14.9107 11.7241 15.0402C10.7831 15.1667 9.5771 15.1667 8.03817 15.1667H7.96167C6.42274 15.1667 5.21671 15.1667 4.27572 15.0402C3.31257 14.9107 2.55255 14.6405 1.95601 14.044C1.35947 13.4474 1.08924 12.6874 0.95975 11.7242C0.833237 10.7832 0.833244 9.57722 0.833252 8.03829V7.96179C0.833244 6.42286 0.833237 5.21684 0.95975 4.27584C1.08924 3.31269 1.35947 2.55267 1.95601 1.95613C2.55255 1.35959 3.31257 1.08936 4.27572 0.959872C5.21671 0.833359 6.42274 0.833366 7.96167 0.833374ZM11.1803 1.51732C12.0922 0.605393 13.5707 0.605393 14.4826 1.51732C15.3946 2.42924 15.3946 3.90776 14.4826 4.81969L10.0506 9.25176C9.80306 9.49931 9.648 9.65438 9.47497 9.78934C9.27118 9.9483 9.05067 10.0846 8.81735 10.1958C8.61926 10.2902 8.41122 10.3595 8.07911 10.4702L6.14276 11.1156C5.78526 11.2348 5.39112 11.1418 5.12466 10.8753C4.8582 10.6088 4.76515 10.2147 4.88432 9.8572L5.52976 7.92086C5.64044 7.58874 5.70978 7.3807 5.80418 7.18261C5.91538 6.94929 6.05166 6.72878 6.21062 6.52499C6.34558 6.35195 6.50065 6.1969 6.74822 5.94937L11.1803 1.51732ZM13.7755 2.22442C13.2541 1.70302 12.4088 1.70302 11.8874 2.22442L11.6363 2.4755C11.6514 2.53941 11.6726 2.61555 11.7021 2.70048C11.7976 2.97586 11.9784 3.33852 12.3199 3.68004C12.6614 4.02156 13.0241 4.20235 13.2995 4.29789C13.3844 4.32735 13.4605 4.34853 13.5245 4.36366L13.7755 4.11258C14.2969 3.59118 14.2969 2.74582 13.7755 2.22442ZM12.7367 5.15143C12.3927 5.0035 11.992 4.76635 11.6128 4.38714C11.2336 4.00794 10.9965 3.60726 10.8485 3.26328L7.47826 6.63355C7.20058 6.91122 7.09168 7.02134 6.99913 7.14001C6.88484 7.28653 6.78685 7.44508 6.70691 7.61283C6.64216 7.74868 6.59237 7.89533 6.46819 8.26787L6.18026 9.13166L6.8683 9.8197L7.73209 9.53177C8.10463 9.40759 8.25128 9.35779 8.38713 9.29305C8.55488 9.21311 8.71342 9.11512 8.85995 9.00083C8.97862 8.90828 9.08874 8.79938 9.36641 8.5217L12.7367 5.15143Z" fill="#1E2023" />
                          </g>
                          <defs>
                            <clipPath id="clip0_367_7217">
                              <rect width="16" height="16" fill="white" />
                            </clipPath>
                          </defs>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header-pages">
              <h3 className="modal-title">
                ویرایش صفحه {modalData.title}
              </h3>
            </div>

            {renderModalContent()}

            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                onClick={handleCloseModal}
                disabled={isSaving}
              >
                انصراف
              </button>
              <button
                className="modal-save-btn"
                onClick={handleSaveModal}
                disabled={isSaving}
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Add Modal */}
      {isFAQModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">افزودن سوال جدید</h3>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label className="form-label">عنوان سوال</label>
                <div className="input-with-language-btn">
                  <input
                    type="text"
                    className="form-input"
                    value={newFAQ.question}
                    onChange={(e) => setNewFAQ({ ...newFAQ, question: e.target.value })}
                    placeholder="سوال خود را وارد کنید"
                  />
                  <button
                    className="pages-language-input-btn"
                    type="button"
                    onClick={() => {
                      setCurrentFieldForLanguage('question');
                      setCurrentLanguageData({
                        english: newFAQ.englishQuestion || '',
                        arabic: newFAQ.arabicQuestion || '',
                        urdu: newFAQ.urduQuestion || ''
                      });
                      setIsLanguageModalOpen(true);
                    }}
                    title="ورود سوال به زبان‌های دیگر"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">پاسخ سوال</label>
                <div className="input-with-language-btn">
                  <textarea
                    className="form-textarea"
                    value={newFAQ.answer}
                    onChange={(e) => setNewFAQ({ ...newFAQ, answer: e.target.value })}
                    rows={6}
                    placeholder="پاسخ سوال را وارد کنید"
                  />
                  <button
                    className="pages-language-input-btn"
                    type="button"
                    onClick={() => {
                      setCurrentFieldForLanguage('answer');
                      setCurrentLanguageData({
                        english: newFAQ.englishAnswer || '',
                        arabic: newFAQ.arabicAnswer || '',
                        urdu: newFAQ.urduAnswer || ''
                      });
                      setIsLanguageModalOpen(true);
                    }}
                    title="ورود پاسخ به زبان‌های دیگر"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.66699 2.5H7.50033C6.242 6.83667 6.242 13.1633 7.50033 17.5H6.66699" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12.5 2.5C13.7583 6.83667 13.7583 13.1633 12.5 17.5" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                onClick={handleCloseFAQModal}
                disabled={isSaving}
              >
                انصراف
              </button>
              <button
                className="modal-save-btn"
                onClick={handleAddFAQ}
                disabled={!newFAQ.question.trim() || !newFAQ.answer.trim() || isSaving}
              >
                افزودن سوال
              </button>
            </div>
          </div>
        </div>
      )}
      {isLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="language-titles-modal">
            <div className="modal-header">
              <h3>ویرایش متن به زبان‌های دیگر</h3>
            </div>

            <div className="modal-content">
              <div className="language-input-group">
                <label>انگلیسی</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Text in English"
                  value={currentLanguageData.english}
                  onChange={(e) => setCurrentLanguageData(prev => ({
                    ...prev,
                    english: e.target.value
                  }))}
                />
              </div>

              <div className="language-input-group">
                <label>عربی</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="النص بالعربیة"
                  value={currentLanguageData.arabic}
                  onChange={(e) => setCurrentLanguageData(prev => ({
                    ...prev,
                    arabic: e.target.value
                  }))}
                />
              </div>

              <div className="language-input-group">
                <label>اردو</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="متن اردو میں"
                  value={currentLanguageData.urdu}
                  onChange={(e) => setCurrentLanguageData(prev => ({
                    ...prev,
                    urdu: e.target.value
                  }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                onClick={() => {
                  if (!isSaving) {
                    setIsLanguageModalOpen(false);
                  }
                }}
                disabled={isSaving}
              >
                انصراف
              </button>
              <button
                className="modal-save-btn"
                onClick={() => {
                  // Save language data based on current field
                  if (currentFieldForLanguage === 'question') {
                    setNewFAQ(prev => ({
                      ...prev,
                      englishQuestion: currentLanguageData.english,
                      arabicQuestion: currentLanguageData.arabic,
                      urduQuestion: currentLanguageData.urdu
                    }));
                  } else if (currentFieldForLanguage === 'answer') {
                    setNewFAQ(prev => ({
                      ...prev,
                      englishAnswer: currentLanguageData.english,
                      arabicAnswer: currentLanguageData.arabic,
                      urduAnswer: currentLanguageData.urdu
                    }));
                  } else if (currentFieldForLanguage === 'faq-question' && currentFAQIndex !== null) {
                    const updatedFaqs = [...faqs];
                    const updatedFaq = {
                      ...updatedFaqs[currentFAQIndex],
                      englishQuestion: currentLanguageData.english,
                      arabicQuestion: currentLanguageData.arabic,
                      urduQuestion: currentLanguageData.urdu
                    };

                    const updateFaq = async () => {
                      setIsSaving(true);
                      try {
                        const response = await adminPagesService.updateFaq(
                          updatedFaq.id,
                          updatedFaq
                        );
                        updatedFaqs[currentFAQIndex] = normalizeFaqItem(response);
                        setFaqs(updatedFaqs);
                        setIsLanguageModalOpen(false);
                        setCurrentFieldForLanguage(null);
                        setCurrentFAQIndex(null);
                      } catch (error) {
                        alert('به‌روزرسانی سوال با خطا مواجه شد.');
                      } finally {
                        setIsSaving(false);
                      }
                    };

                    updateFaq();
                    return;
                  } else if (currentFieldForLanguage === 'about-description') {
                    setModalData(prev => ({
                      ...prev,
                      englishDescription: currentLanguageData.english,
                      arabicDescription: currentLanguageData.arabic,
                      urduDescription: currentLanguageData.urdu
                    }));
                  } else if (currentFieldForLanguage === 'contact-description') {
                    setModalData(prev => ({
                      ...prev,
                      englishDescription: currentLanguageData.english,
                      arabicDescription: currentLanguageData.arabic,
                      urduDescription: currentLanguageData.urdu
                    }));
                  } else if (currentFieldForLanguage === 'contact-address') {
                    setModalData(prev => ({
                      ...prev,
                      englishAddress: currentLanguageData.english,
                      arabicAddress: currentLanguageData.arabic,
                      urduAddress: currentLanguageData.urdu
                    }));
                  } else if (currentFieldForLanguage === 'rules-description') {
                    setModalData(prev => ({
                      ...prev,
                      englishDescription: currentLanguageData.english,
                      arabicDescription: currentLanguageData.arabic,
                      urduDescription: currentLanguageData.urdu
                    }));
                  }

                  if (!isSaving) {
                    setIsLanguageModalOpen(false);
                    setCurrentFieldForLanguage(null);
                    setCurrentFAQIndex(null);
                  }
                }}
                disabled={isSaving}
              >
                تایید
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Get the appropriate button class based on page type
const getEditButtonClass = (pageType) => {
  switch (pageType) {
    case 'support': return 'edit-pages-btn-support';
    case 'faq': return 'edit-pages-btn-faq';
    case 'rules': return 'edit-pages-btn-rules';
    case 'about': return 'edit-pages-btn-about';
    case 'contact': return 'edit-pages-btn-contact';
    default: return 'edit-pages-btn';
  }
};

export default PagesManage;
