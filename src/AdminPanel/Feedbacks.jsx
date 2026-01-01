// src/pages/Feedbacks.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';
import { listAdminSupportFeedbacks, updateAdminSupportFeedbackStatus } from '../services/adminSupportService';

const DEFAULT_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const statusOptions = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'new', label: 'جدید' },
  { value: 'seen', label: 'دیده‌شده' },
  { value: 'in_progress', label: 'در حال بررسی' },
  { value: 'closed', label: 'بسته‌شده' }
];

const statusLabels = {
  new: 'جدید',
  seen: 'دیده‌شده',
  in_progress: 'در حال بررسی',
  closed: 'بسته‌شده'
};

const Feedbacks = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('new');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingStatusIds, setUpdatingStatusIds] = useState(new Set());

  // Modal state
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const formatPersianDateTime = (dateValue) => {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('fa-IR');
  };

  const fetchFeedbacks = async ({ page = currentPage } = {}) => {
    setIsLoading(true);

    try {
      const response = await listAdminSupportFeedbacks({
        status: statusFilter || undefined,
        q: searchTerm || undefined,
        limit: itemsPerPage,
        page
      });

      const items = response?.data || [];
      const pagination = response?.pagination || {};

      setFeedbacks(items);
      setTotalItems(pagination.total ?? items.length);
      setLastPage(pagination.lastPage ?? 1);
      setCurrentPage(pagination.currentPage ?? page);
    } catch (error) {
      toast.error('بارگذاری بازخوردها ناموفق بود');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks({ page: currentPage });
  }, [currentPage, statusFilter, searchTerm]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFeedbacks({ page: 1 });
    setIsRefreshing(false);
    toast.success('لیست بازخوردها به‌روزرسانی شد');
  };

  const openDetailsModal = (feedback) => {
    setSelectedFeedback(feedback);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setSelectedFeedback(null);
    setIsDetailsModalOpen(false);
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > lastPage) return;
    setCurrentPage(pageNumber);
  };

  const getPageNumbers = useMemo(() => {
    const pages = [];
    const maxVisiblePages = 6;

    if (lastPage <= maxVisiblePages) {
      for (let i = 1; i <= lastPage; i += 1) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(lastPage, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i += 1) {
        pages.push(i);
      }
    }

    return pages;
  }, [currentPage, lastPage]);

  const updateStatus = async (feedback, nextStatus) => {
    if (!nextStatus || feedback.status === nextStatus) return;

    const previousStatus = feedback.status;

    setUpdatingStatusIds((prev) => new Set(prev).add(feedback.id));
    setFeedbacks((prev) =>
      prev.map((item) => (item.id === feedback.id ? { ...item, status: nextStatus } : item))
    );

    if (selectedFeedback?.id === feedback.id) {
      setSelectedFeedback((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    }

    try {
      await updateAdminSupportFeedbackStatus(feedback.id, { status: nextStatus });
      toast.success('وضعیت بازخورد به‌روزرسانی شد');
    } catch (error) {
      setFeedbacks((prev) =>
        prev.map((item) => (item.id === feedback.id ? { ...item, status: previousStatus } : item))
      );

      if (selectedFeedback?.id === feedback.id) {
        setSelectedFeedback((prev) => (prev ? { ...prev, status: previousStatus } : prev));
      }

      toast.error('به‌روزرسانی وضعیت ناموفق بود');
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(feedback.id);
        return next;
      });
    }
  };

  const renderUserCell = (feedback) => {
    const user = feedback.user || null;
    const userName = user?.name || user?.fullName || 'کاربر مهمان';
    const userPhone = user?.phone || '—';

    return (
      <div className="sender-info">
        <span className="sender-name">{userName}</span>
        <span className="feedback-user-phone">{userPhone}</span>
      </div>
    );
  };

  return (
    <div className="feedbacks-page">
      {/* Page Header */}
      <div className="section-header">
        <div className="section-header-top">
          <div className="title-container">
            <div className="title-cell">
              <h3>بازخوردهای کاربران در اپلیکیشن</h3>
              <button
                className="refresh-btn"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <div
                    className="loading-spinner"
                    style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid #f3f3f3',
                      borderTop: '2px solid #1E2023',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}
                  ></div>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692"
                      stroke="#1E2023"
                      strokeWidth="1.08112"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p></p>
          </div>
          <div className="left-container">
            <select
              className="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="search-box-with-icon">
              <svg
                className="search-icon7"
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z"
                  fill="#858585"
                />
              </svg>
              <input
                type="text"
                placeholder="جستجوی موضوع یا متن بازخورد..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
              <th>تاریخ</th>
              <th>موضوع</th>
              <th>وضعیت</th>
              <th>کاربر/شماره</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  در حال بارگذاری...
                </td>
              </tr>
            ) : feedbacks.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  بازخوردی یافت نشد
                </td>
              </tr>
            ) : (
              feedbacks.map((feedback) => (
                <tr
                  key={feedback.id}
                  className={`feedback-row ${feedback.status === 'new' ? 'new-feedback' : ''}`}
                >
                  <td>{formatPersianDateTime(feedback.createdAt)}</td>
                  <td>
                    <div className="feedback-title">{feedback.subject}</div>
                  </td>
                  <td>
                    <div className="status-cell">
                      <span className={`status-badge ${feedback.status}`}>
                        {statusLabels[feedback.status] || feedback.status}
                      </span>
                      <select
                        className="status-select"
                        value={feedback.status}
                        onChange={(event) => updateStatus(feedback, event.target.value)}
                        disabled={updatingStatusIds.has(feedback.id)}
                      >
                        {statusOptions
                          .filter((option) => option.value)
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  </td>
                  <td>{renderUserCell(feedback)}</td>
                  <td>
                    <button
                      className="details-btn"
                      onClick={() => openDetailsModal(feedback)}
                      id={`details-btn-${feedback.id}`}
                    >
                      جزئیات بیشتر
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M11.0176 3.63828C11.2404 3.82922 11.2662 4.1646 11.0752 4.38737L7.12156 8.99997L11.0752 13.6126C11.2662 13.8353 11.2404 14.1707 11.0176 14.3617C10.7948 14.5526 10.4595 14.5268 10.2685 14.304L6.01851 9.3457C5.84798 9.14675 5.84798 8.85318 6.01851 8.65424L10.2685 3.6959C10.4595 3.47314 10.7948 3.44734 11.0176 3.63828Z"
                          fill="#1E2023"
                        />
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
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ transform: 'rotate(180deg)' }}
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z"
                      fill={currentPage === 1 ? '#C5C5C5' : '#0F71EF'}
                    />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ transform: 'rotate(180deg)' }}
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z"
                      fill={currentPage === 1 ? '#C5C5C5' : '#0F71EF'}
                    />
                  </svg>
                </button>
              </div>

              <div className="page-numbers">
                {getPageNumbers.map((page) => (
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
                  className={`pagination-btn ${currentPage === lastPage ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === lastPage}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z"
                      fill={currentPage === lastPage ? '#C5C5C5' : '#0F71EF'}
                    />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === lastPage ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(lastPage)}
                  disabled={currentPage === lastPage}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z"
                      fill={currentPage === lastPage ? '#C5C5C5' : '#0F71EF'}
                    />
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
                    {statusLabels[selectedFeedback.status] || selectedFeedback.status}
                  </span>
                  <span className="read-time">
                    {formatPersianDateTime(selectedFeedback.createdAt)}
                  </span>
                </div>
              </div>
              <button
                className="close-btn"
                onClick={closeDetailsModal}
                id="close-feedback-details-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-feedback-details">
              <div className="sender-info-modal">
                <h4>نام فرستنده</h4>
                <div className="sender-name-modal">
                  {selectedFeedback.user?.name || selectedFeedback.user?.fullName || 'کاربر مهمان'}
                </div>
              </div>

              <div className="feedback-title-section">
                <h4>موضوع بازخورد</h4>
                <div className="feedback-title-text">{selectedFeedback.subject}</div>
              </div>

              <div className="feedback-content-section">
                <h4>متن بازخورد</h4>
                <div className="feedback-text">{selectedFeedback.message}</div>
              </div>
            </div>
            <div className="modal-footer-feedback">
              <button
                className="action-btn close-feedback-btn"
                onClick={closeDetailsModal}
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
