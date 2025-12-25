// src/pages/Feedbacks.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';

const Feedbacks = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  
  // Modal state
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Initial sample feedback data with timestamps
  const initialSampleFeedbacks = [
    {
      id: 1,
      sender: 'سیدمحمدحسین میرشفیعی',
      title: 'پیشنهاد بهبود مسیریابی',
      feedback: 'لزوم امیموم متن ساخگی با تولید سادگی نامفهوم از صنعت چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است و برای شرایط فعلی تکنولوژی مورد نیاز و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد.',
      date: '۱۴۰۴ مرداد',
      status: 'new',
      createdAt: new Date('2024-08-01T10:30:00'),
      readAt: null
    },
    {
      id: 2,
      sender: 'علی رضایی',
      title: 'مشکل در نمایش نقشه',
      feedback: 'لزوم امیموم متن ساخگی با تولید سادگی نامفهوم از صنعت چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است. کتابهای زیادی در شصت و سه درصد گذشته، حال و آینده شناخت فراوان جامعه و متخصصان را می طلبد.',
      date: '۱۴۰۴ مرداد',
      status: 'new',
      createdAt: new Date('2024-08-02T14:20:00'),
      readAt: new Date('2024-08-03T09:15:00')
    },
    {
      id: 3,
      sender: 'محمد حسینی',
      title: 'پیشنهاد ویژگی جدید',
      feedback: 'لزوم امیموم متن ساخگی با تولید سادگی نامفهوم از صنعت چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است. با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی و فرهنگ پیشرو در زبان فارسی ایجاد کرد.',
      date: '۱۴۰۴ مرداد',
      status: 'new',
      createdAt: new Date('2024-08-03T16:45:00'),
      readAt: null
    },
    {
      id: 4,
      sender: 'فاطمه محمدی',
      title: 'انتقاد از رابط کاربری',
      feedback: 'لزوم امیموم متن ساخگی با تولید سادگی نامفهوم از صنعت چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است. در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها و شرایط سخت تایپ به پایان رسد.',
      date: '۱۴۰۴ مرداد',
      status: 'new',
      createdAt: new Date('2024-08-04T11:10:00'),
      readAt: new Date('2024-08-05T08:30:00')
    },
    {
      id: 5,
      sender: 'ایمان قاسمی',
      title: 'گزارش مشکل فنی',
      feedback: 'لزوم امیموم متن ساخگی با تولید سادگی نامفهوم از صنعت چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است و برای شرایط فعلی تکنولوژی مورد نیاز و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد.',
      date: '۱۴۰۴ مرداد',
      status: 'new',
      createdAt: new Date('2024-08-05T13:25:00'),
      readAt: null
    },
    {
      id: 6,
      sender: 'نگین سالاری',
      title: 'پیشنهاد محتوا',
      feedback: 'لزوم امیموم متن ساخگی با تولید سادگی نامفهوم از صنعت چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است. در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها و شرایط سخت تایپ به پایان رسد.',
      date: '۱۴۰۴ شهریور',
      status: 'new',
      createdAt: new Date('2024-08-06T09:40:00'),
      readAt: new Date('2024-08-07T10:20:00')
    },
    {
      id: 7,
      sender: 'رضا کریمی',
      title: 'انتقاد از سرعت برنامه',
      feedback: 'لزوم امیموم متن ساخگی با تولید سادگی نامفهوم از صنعت چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است و برای شرایط فعلی تکنولوژی مورد نیاز و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد.',
      date: '۱۴۰۴ شهریور',
      status: 'new',
      createdAt: new Date('2024-08-07T15:55:00'),
      readAt: null
    }
  ];

  // State for sample feedbacks that can be updated
  const [sampleFeedbacks, setSampleFeedbacks] = useState(initialSampleFeedbacks);

  // Format date to Persian time
  const formatPersianTime = (date) => {
    if (!date) return '';
    const persianTime = date.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const persianDate = date.toLocaleDateString('fa-IR');
    return `${persianDate} - ${persianTime}`;
  };

  // Mark feedback as read
  const markAsRead = (id) => {
    const now = new Date();
    const updatedFeedbacks = sampleFeedbacks.map(feedback => {
      if (feedback.id === id && feedback.status === 'new') {
        return {
          ...feedback,
          status: 'read',
          readAt: now
        };
      }
      return feedback;
    });
    
    setSampleFeedbacks(updatedFeedbacks);
    
    // Update the filtered list
    const updatedFiltered = feedbacks.map(feedback => {
      if (feedback.id === id && feedback.status === 'new') {
        return {
          ...feedback,
          status: 'read',
          readAt: now
        };
      }
      return feedback;
    });
    
    setFeedbacks(updatedFiltered);
  };

  // Load feedbacks on component mount
  useEffect(() => {
    loadFeedbacks();
  }, []);

  // Filter feedbacks based on search term
  useEffect(() => {
    const filtered = sampleFeedbacks.filter(feedback =>
      feedback.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.feedback.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFeedbacks(filtered);
    setTotalItems(filtered.length);
    setCurrentPage(1); // Reset to first page when searching
  }, [searchTerm, sampleFeedbacks]);

  const loadFeedbacks = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setFeedbacks([...sampleFeedbacks]);
      setTotalItems(sampleFeedbacks.length);
      setIsLoading(false);
    }, 500);
  };

  const handleRefresh = () => {
    loadFeedbacks();
    toast.success('لیست بازخوردها به‌روزرسانی شد');
  };

  const openDetailsModal = (feedback) => {
    setSelectedFeedback(feedback);
    setIsDetailsModalOpen(true);
    
    // Mark as read when opening modal
    if (feedback.status === 'new') {
      markAsRead(feedback.id);
    }
  };

  // Handle click on status badge
  const handleStatusClick = (feedback, e) => {
    e.stopPropagation();
    if (feedback.status === 'new') {
      markAsRead(feedback.id);
      toast.success('بازخورد به عنوان خوانده شده علامت‌گذاری شد');
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFeedbacks = feedbacks.slice(startIndex, endIndex);
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 6;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  // Count new feedbacks for badge
  const newFeedbacksCount = feedbacks.filter(f => f.status === 'new').length;

  return (
    <div className="feedbacks-page">
      {/* Page Header */}
      <div className="section-header">
        <div className="section-header-top">
          <div className="title-container">
            <div className="title-cell">
              <h3>
                بازخوردهای کاربران در اپلیکیشن
                {/* {newFeedbacksCount > 0 && (
                  <span className="new-count-badge">
                    {newFeedbacksCount} جدید
                  </span>
                )} */}
              </h3>
              <button className="refresh-btn" onClick={handleRefresh}>
                <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p></p>
          </div>
          <div className="left-container">
            <div className="search-box-with-icon">
              <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
              </svg>
              <input
                type="text"
                placeholder="جستجوی عنوان، فرستنده، بازخورد..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input7"
                id="feedback-search-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Feedbacks Table */}
      <div className="users-table-container" id="feedbacks-table-container">
        <table className="users-table" id="feedbacks-table">
          <thead>
            <tr>
              <th>فرستنده</th>
              <th>عنوان</th>
              <th>بازخورد</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                  در حال بارگذاری...
                </td>
              </tr>
            ) : currentFeedbacks.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                  بازخوردی یافت نشد
                </td>
              </tr>
            ) : (
              currentFeedbacks.map(feedback => (
                <tr key={feedback.id} className={`feedback-row ${feedback.status === 'new' ? 'new-feedback' : ''}`}>
                  <td>
                    <div className="sender-info">
                      <span className="sender-name">{feedback.sender}</span>
                      <span 
                        className={`status-badge ${feedback.status} ${feedback.status === 'new' ? 'clickable-status' : ''}`}
                        onClick={(e) => handleStatusClick(feedback, e)}
                        // title={feedback.status === 'new' ? 'کلیک برای علامت‌گذاری به عنوان خوانده شده' : `خوانده شده در: ${formatPersianTime(feedback.readAt)}`}
                      >
                        {feedback.status === 'new' ? 'جدید' : 'خوانده شده'}
                        {feedback.status === 'read' && feedback.readAt && (
                          <span className="read-indicator">✓</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="feedback-title">
                      {feedback.title}
                    </div>
                  </td>
                  <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>
                    <div className="feedback-preview">
                      {feedback.feedback.split(/\s+/).slice(0, 7).join(' ')}
                      {feedback.feedback.split(/\s+/).length > 7 && '...'}
                    </div>
                  </td>
                  <td>
                    <button
                      className="details-btn"
                      onClick={() => openDetailsModal(feedback)}
                      id={`details-btn-${feedback.id}`}
                    >
                      جزئیات بیشتر
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.0176 3.63828C11.2404 3.82922 11.2662 4.1646 11.0752 4.38737L7.12156 8.99997L11.0752 13.6126C11.2662 13.8353 11.2404 14.1707 11.0176 14.3617C10.7948 14.5526 10.4595 14.5268 10.2685 14.304L6.01851 9.3457C5.84798 9.14675 5.84798 8.85318 6.01851 8.65424L10.2685 3.6959C10.4595 3.47314 10.7948 3.44734 11.0176 3.63828Z" fill="#1E2023" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!isLoading && feedbacks.length > 0 && (
          <div className="pagination-container" id="feedbacks-pagination">
            <div className="pagination-controls">
              <div className="btc">
                <button
                  className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>
              </div>

              <div className="page-numbers">
                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    className={`page-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <div className="btc">
                <button
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Details Modal */}
      {isDetailsModalOpen && selectedFeedback && (
        <div className="modal-overlay" id="feedback-details-modal">
          <div className="feedback-details-modal">
            <div className="modal-header-feedback-details">
              <div className="modal-header-left">
                <h3>جزئیات بازخورد</h3>
                <div className="feedback-status-info">
                  <span className={`status-badge-modal ${selectedFeedback.status}`}>
                    {selectedFeedback.status === 'new' ? 'جدید' : 'خوانده شده'}
                  </span>
                  {selectedFeedback.status === 'read' && selectedFeedback.readAt && (
                    <span className="read-time">
                      خوانده شده در: {formatPersianTime(selectedFeedback.readAt)}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => setIsDetailsModalOpen(false)}
                id="close-feedback-details-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-feedback-details">
              <div className="sender-info-modal">
                <h4>نام فرستنده</h4>
                <div className="sender-name-modal">
                  {selectedFeedback.sender}
                </div>
              </div>
              
              <div className="feedback-title-section">
                <h4>عنوان بازخورد</h4>
                <div className="feedback-title-text">
                  {selectedFeedback.title}
                </div>
              </div>
              
              <div className="feedback-content-section">
                <h4>متن بازخورد</h4>
                <div className="feedback-text">
                  {selectedFeedback.feedback}
                </div>
              </div>
            </div>
            <div className="modal-footer-feedback">
              <button
                className="action-btn close-feedback-btn"
                onClick={() => setIsDetailsModalOpen(false)}
                id="close-feedback-modal-btn"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedbacks;