// src/pages/Reviews.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';
import adminCommentsService from '../services/adminCommentsService';

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [rejectionReasonMap, setRejectionReasonMap] = useState({});

  // Modal states
  const [selectedReview, setSelectedReview] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRejectionDetailsModalOpen, setIsRejectionDetailsModalOpen] = useState(false);

  // Rejection modal states
  const [rejectionReasons, setRejectionReasons] = useState({
    offensiveWords: false,
    adultContent: false,
    irrelevantTopic: false,
    other: false
  });
  const [otherReasonText, setOtherReasonText] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);


  const mapCommentToReview = useCallback(
    (comment) => ({
      id: comment?.id,
      comment: comment?.content ?? '',
      sender: comment?.authorName || comment?.authorEmail || 'نامشخص',
      date: comment?.createdAt ?? '',
      section: comment?.postId != null ? String(comment.postId) : '-',
      status: comment?.status ?? 'pending',
      operation: '',
      rejectionReasons: rejectionReasonMap[comment?.id] || []
    }),
    [rejectionReasonMap]
  );

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminCommentsService.list({
        page: currentPage,
        perPage: itemsPerPage,
        authorName: searchTerm || undefined,
        authorEmail: searchTerm || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      const data = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || {};
      setReviews(data.map(mapCommentToReview));
      setTotalPages(Math.max(1, pagination.totalPages ?? 1));
    } catch (error) {
      toast.error('دریافت لیست دیدگاه‌ها ناموفق بود');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, mapCommentToReview, searchTerm]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadReviews();
    toast.success('لیست دیدگاه‌ها به‌روزرسانی شد');
    setIsRefreshing(false);
  };

  const handleApproveReview = async (id) => {
    try {
      await adminCommentsService.updateStatus(id, { status: 'approved' });
      const updatedReviews = reviews.map(review => {
        if (review.id === id) {
          return {
            ...review,
            status: 'approved',
            operation: 'تایید شده'
          };
        }
        return review;
      });

      setReviews(updatedReviews);
      if (selectedReview?.id === id) {
        setSelectedReview({
          ...selectedReview,
          status: 'approved',
          operation: 'تایید شده'
        });
      }
      toast.success('دیدگاه با موفقیت تایید شد');
    } catch (error) {
      toast.error('تایید دیدگاه انجام نشد');
    }
  };

  const openRejectModal = (review) => {
    setSelectedReview(review);

    setRejectionReasons({
      offensiveWords: false,
      adultContent: false,
      irrelevantTopic: false,
      other: false
    });
    setOtherReasonText('');

    setIsRejectModalOpen(true);
  };

  const openRejectionDetailsModal = (review) => {
    setSelectedReview(review);
    setIsRejectionDetailsModalOpen(true);
    fetchReviewDetails(review.id);
  };

  const handleRejectReview = async () => {

    const hasReason = Object.values(rejectionReasons).some(value => value);
    if (!hasReason) {
      toast.error('لطفا حداقل یک دلیل برای رد انتخاب کنید');
      return;
    }


    if (rejectionReasons.other && !otherReasonText.trim()) {
      toast.error('لطفا دلایل دیگر را وارد کنید');
      return;
    }

    setIsSubmittingRejection(true);

    const reasons = [];
    if (rejectionReasons.offensiveWords) reasons.push('کلمات و جملات هنجارشکن');
    if (rejectionReasons.adultContent) reasons.push('محتوای بزرگسالان');
    if (rejectionReasons.irrelevantTopic) reasons.push('عدم تطابق با موضوع');
    if (rejectionReasons.other && otherReasonText.trim()) {
      reasons.push(`سایر: ${otherReasonText.trim()}`);
    }

    try {
      await adminCommentsService.updateStatus(selectedReview.id, { status: 'rejected' });
      setRejectionReasonMap((prev) => ({
        ...prev,
        [selectedReview.id]: reasons
      }));
      const updatedReviews = reviews.map(review => {
        if (review.id === selectedReview.id) {
          return {
            ...review,
            status: 'rejected',
            operation: 'رد شده',
            rejectionReasons: reasons
          };
        }
        return review;
      });

      setReviews(updatedReviews);
      if (selectedReview?.id === selectedReview.id) {
        setSelectedReview({
          ...selectedReview,
          status: 'rejected',
          operation: 'رد شده',
          rejectionReasons: reasons
        });
      }
      setIsRejectModalOpen(false);

      setRejectionReasons({
        offensiveWords: false,
        adultContent: false,
        irrelevantTopic: false,
        other: false
      });
      setOtherReasonText('');

      toast.success('دیدگاه با موفقیت رد شد');
    } catch (error) {
      toast.error('رد دیدگاه انجام نشد');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  const fetchReviewDetails = useCallback(async (reviewId) => {
    try {
      const response = await adminCommentsService.get(reviewId);
      const mapped = mapCommentToReview(response);
      setSelectedReview((prev) => {
        if (!prev || prev.id !== reviewId) return prev;
        return {
          ...mapped,
          rejectionReasons: prev.rejectionReasons || rejectionReasonMap[reviewId] || []
        };
      });
    } catch (error) {
      toast.error('دریافت جزئیات دیدگاه ناموفق بود');
    }
  }, [mapCommentToReview, rejectionReasonMap]);

  const openDetailsModal = (review) => {
    setSelectedReview(review);
    setIsDetailsModalOpen(true);
    fetchReviewDetails(review.id);
  };

  const handleReasonChange = (reason) => {
    setRejectionReasons(prev => ({
      ...prev,
      [reason]: !prev[reason]
    }));
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const currentReviews = useMemo(() => reviews, [reviews]);

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

  const getStatusBadge = (status, review = null) => {
    switch (status) {
      case 'approved':
        return <span className="status-badge approved">تایید شده</span>;
      case 'rejected':
        const rejectionReasons = review?.rejectionReasons?.length > 0
          ? review.rejectionReasons
          : ['دلیل ثبت نشده است'];
        return (
          <span className="status-badge rejected tooltip-trigger">
            رد شده
            <div className="tooltip-content">
              دلیل رد: {rejectionReasons.join('، ')}
            </div>
          </span>
        );
      case 'pending':
        return <span className="status-badge pending">در انتظار</span>;
      default:
        return <span className="status-badge pending">در انتظار</span>;
    }
  };

  return (
    <div className="reviews-page">
      {/* Page Header */}
      <div className="section-header">
        <div className="section-header-top">
          <div className="title-container">
            <div className="title-cell">
              <h3>دیدگاه های کاربران در اپلیکیشن</h3>
              <button className="refresh-btn"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <div className="loading-spinner" style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #1E2023',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
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
                placeholder="جستجوی دیدگاه، فرستنده، بخش..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input7"
                id="review-search-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="users-table-container" id="reviews-table-container">
        <table className="users-table" id="reviews-table">
          <thead>
            <tr>
              <th>دیدگاه</th>
              <th>فرستنده</th>
              <th>تاریخ ارسال</th>
              <th>بخش</th>
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
            ) : currentReviews.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  دیدگاهی یافت نشد
                </td>
              </tr>
            ) : (
              currentReviews.map(review => (
                <tr key={review.id}>
                  <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>
                    <div className="comment-preview">
                      {review.comment.split(/\s+/).slice(0, 7).join(' ')}
                      {review.comment.split(/\s+/).length > 7 && '...'}
                    </div>
                  </td>
                  <td>{review.sender}</td>
                  <td>{review.date}</td>
                  <td>{review.section}</td>
                  <td>
                    <div className="operation-actions">

                      <div className="status-actions">
                        {review.status === 'pending' ? (
                          <>
                            <button
                              className="approve-btn"
                              onClick={() => handleApproveReview(review.id)}
                              id={`approve-btn-${review.id}`}
                            >
                              تایید
                            </button>
                            <button
                              className="reject-btn"
                              onClick={() => openRejectModal(review)}
                              id={`reject-btn-${review.id}`}
                            >
                              رد
                            </button>
                          </>
                        ) : review.status === 'approved' ? (
                          <span
                            className="status-badge approved clickable-status"
                            onClick={() => openDetailsModal(review)}
                          >
                            تایید شده
                          </span>
                        ) : review.status === 'rejected' ? (
                          <span
                            className="status-badge rejected clickable-status tooltip-trigger"
                            onClick={() => openRejectionDetailsModal(review)}
                          >
                            رد شده
                            <div className="tooltip-content">
                              دلیل رد: {review.rejectionReasons && review.rejectionReasons.length > 0
                                ? review.rejectionReasons.join('، ')
                                : 'دلیل ثبت نشده است'}
                              <br />
                              <em style={{ fontSize: '10px', color: '#D1D5DB' }}>(کلیک برای جزئیات)</em>
                            </div>
                          </span>
                        ) : null}
                      </div>
                      <button
                        className="details-btn"
                        onClick={() => openDetailsModal(review)}
                        id={`details-btn-${review.id}`}
                      >
                        جزئیات بیشتر
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M11.0176 3.63828C11.2404 3.82922 11.2662 4.1646 11.0752 4.38737L7.12156 8.99997L11.0752 13.6126C11.2662 13.8353 11.2404 14.1707 11.0176 14.3617C10.7948 14.5526 10.4595 14.5268 10.2685 14.304L6.01851 9.3457C5.84798 9.14675 5.84798 8.85318 6.01851 8.65424L10.2685 3.6959C10.4595 3.47314 10.7948 3.44734 11.0176 3.63828Z" fill="#1E2023" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!isLoading && reviews.length > 0 && (
          <div className="pagination-container" id="reviews-pagination">
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

      {/* Details Modal (Picture 3) */}
      {isDetailsModalOpen && selectedReview && (
        <div className="modal-overlay" id="details-modal">
          <div className="review-details-modal">
            <div className="modal-header-review-details">
              <h3>جزئيات بیشتر دیدگاه ارسال شده</h3>
              <button
                className="close-btn"
                onClick={() => setIsDetailsModalOpen(false)}
                id="close-reject-modal"
              >
                ×
              </button>
            </div >
            <div className="review-details-modal-body">

              <div className="reviewer-info">
                <h4>اطلاعات فرستنده</h4>
                <div className="info-row">
                  <span className="info-label">نام فرستنده</span>
                  <span className="info-value">{selectedReview.sender}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">تاریخ ارسال</span>
                  <span className="info-value">{selectedReview.date}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">بخش</span>
                  <span className="info-value">{selectedReview.section}</span>
                </div>
              </div>
              <div className="review-comment-section">
                <h4>دیدگاه ارسال شده</h4>
                <div className="comment-text">
                  {selectedReview.comment}
                </div>
              </div>
            </div>
            <div className="review-details-modal-footer">
              <button
                className="action-btn reject-btn12"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openRejectModal(selectedReview);
                }}
                id="reject-from-details"
              >
                رد و عدم نمایش
              </button>
              <button
                className="action-btn confirm-btn"
                onClick={() => {
                  handleApproveReview(selectedReview.id);
                  setIsDetailsModalOpen(false);
                }}
                id="confirm-from-details"
              >
                تایید و نمایش
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal (Picture 2) */}
      {isRejectModalOpen && selectedReview && (
        <div className="modal-overlay" id="reject-modal">
          <div className="reject-modal">
            <div className="modal-header-reject-modal">
              <h3>رد و عدم نمایش دیدگاه</h3>
              <button
                className="close-btn"
                onClick={() => setIsRejectModalOpen(false)}
                id="close-reject-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-reject-modal">
              <div className="rejection-reason-section">
                <h4 className="form-label-rejection-reason" >دلیل رد دیدگاه </h4>
                <div className="reason-checkboxes">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rejectionReasons.offensiveWords}
                      onChange={() => handleReasonChange('offensiveWords')}
                      id="reason-offensive"
                    />
                    <span>کلمات و جملات هنجارشکن</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rejectionReasons.adultContent}
                      onChange={() => handleReasonChange('adultContent')}
                      id="reason-adult"
                    />
                    <span>محتوای بزرگسالان</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rejectionReasons.irrelevantTopic}
                      onChange={() => handleReasonChange('irrelevantTopic')}
                      id="reason-irrelevant"
                    />
                    <span>عدم تطابق با موضوع</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rejectionReasons.other}
                      onChange={() => handleReasonChange('other')}
                      id="reason-other"
                    />
                    <span>سایر</span>
                  </label>

                  {rejectionReasons.other && (
                    <div className="other-reason-input">
                      <textarea
                        placeholder="لطفا دلایل دیگر را توضیح دهید..."
                        value={otherReasonText}
                        onChange={(e) => setOtherReasonText(e.target.value)}
                        rows="3"
                        id="other-reason-text"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer17">
              <button
                className="action-btn cancel-btn16"
                onClick={() => setIsRejectModalOpen(false)}
                id="cancel-reject-btn"
              >
                انصراف
              </button>
              <button
                className="action-btn confirm-reject-btn"
                onClick={handleRejectReview}
                disabled={isSubmittingRejection}
                id="confirm-reject-btn"
              >
                {isSubmittingRejection ? 'در حال ارسال...' : 'تایید و رد دیدگاه'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Details Modal (Picture 1) */}
      {isRejectionDetailsModalOpen && selectedReview && (
        <div className="modal-overlay" id="rejection-details-modal">
          <div className="rejection-details-modal">
            <div className="modal-header-rejection-details">
              <h3>مشاهده دلیل رد دیدگاه</h3>
              <button
                className="close-btn"
                onClick={() => setIsRejectionDetailsModalOpen(false)}
                id="close-rejection-details-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-rejection-details">
              <div className="reviewed-comment-section">
                <h4>دیدگاه رد شده</h4>
                <div className="comment-text">
                  {selectedReview.comment}
                </div>
              </div>

              <div className="rejection-reasons-display">
                <h4>دلایل رد</h4>
                <div className="reasons-list">
                  {selectedReview.rejectionReasons && selectedReview.rejectionReasons.length > 0 ? (
                    selectedReview.rejectionReasons.map((reason, index) => (
                      <div key={index} className="reason-item">
                        • {reason}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="reason-item">• کلمات و جملات هنجارشکن</div>
                      <div className="reason-item">• محتوای بزرگسالان</div>
                      <div className="reason-item">• سایر: متن نامناسب برای نمایش عمومی</div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer16">
              <button
                className="action-btn close-modal-btn16"
                onClick={() => setIsRejectionDetailsModalOpen(false)}
                id="close-rejection-modal-btn"
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

export default Reviews;
