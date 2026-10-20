'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { Check, ArrowRight } from '../components/Icons';

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Purchase Modal Flow State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState('AUTH'); // 'AUTH' | 'REVIEW' | 'PAYMENT' | 'SUCCESS' | 'FAILED'
  const [customerToken, setCustomerToken] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [directTokenInput, setDirectTokenInput] = useState('');
  const [showDirectToken, setShowDirectToken] = useState(false);

  // Order & Razorpay State
  const [orderData, setOrderData] = useState(null);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [activationResult, setActivationResult] = useState(null);

  // Load Active Plans from Authoritative PostgreSQL Endpoint
  async function fetchPlans() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/public/subscriptions/plans');
      if (!res.ok) {
        throw new Error('Unable to retrieve subscription plans from server.');
      }
      const json = await res.json();
      setPlans(json.data || []);
    } catch (err) {
      console.error('[SUBSCRIPTIONS FETCH ERROR]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlans();

    // Check for existing customer session in localStorage
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('pondfish_customer_token');
      if (savedToken) {
        setCustomerToken(savedToken);
      }
      const savedInfo = localStorage.getItem('pondfish_customer_info');
      if (savedInfo) {
        try {
          const parsed = JSON.parse(savedInfo);
          if (parsed && parsed.mobileNumber) {
            setCustomerMobile(parsed.mobileNumber);
          }
        } catch (_) {}
      }
    }
  }, []);

  // Initiate purchase modal for a selected plan
  function handleSelectPlan(plan) {
    setSelectedPlan(plan);
    setPaymentError('');
    setAuthError('');
    setActivationResult(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('pondfish_customer_token') : '';
    if (token) {
      setCustomerToken(token);
      setCurrentStep('REVIEW');
    } else {
      setCurrentStep('AUTH');
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedPlan(null);
    setPaymentError('');
    setAuthError('');
    setProcessingOrder(false);
  }

  // Customer OTP Send
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    setAuthError('');
    const cleanMobile = customerMobile.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length !== 10) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/customer/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: cleanMobile }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to dispatch verification OTP.');
      }
      setOtpSent(true);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Customer Direct Token Login (supports existing customer session)
  function handleApplyDirectToken(e) {
    if (e) e.preventDefault();
    setAuthError('');
    const token = directTokenInput.trim();
    if (!token) {
      setAuthError('Please enter a valid customer session token.');
      return;
    }
    setCustomerToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pondfish_customer_token', token);
    }
    setCurrentStep('REVIEW');
  }

  // Customer OTP Verification
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    setAuthError('');
    const cleanMobile = customerMobile.replace(/\D/g, '').slice(-10);

    if (!otpInput.trim()) {
      setAuthError('Please enter the received OTP code.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/customer/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileNumber: cleanMobile,
          idToken: otpInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Authentication verification failed.');
      }

      const token = data.data.token;
      setCustomerToken(token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pondfish_customer_token', token);
        localStorage.setItem('pondfish_customer_info', JSON.stringify(data.data.customer));
      }
      setCurrentStep('REVIEW');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Step 2 -> 3: Proceed to Razorpay Payment Order Generation
  async function handleProceedToPayment() {
    if (!selectedPlan || !customerToken) {
      setCurrentStep('AUTH');
      return;
    }

    setPaymentError('');
    setProcessingOrder(true);

    try {
      const res = await fetch('/api/v1/customer/subscription/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('pondfish_customer_token');
          }
          setCustomerToken('');
          setCurrentStep('AUTH');
          setAuthError('Your customer session expired. Please sign in again.');
          return;
        }
        if (json.error?.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
          throw new Error('Payment gateway credentials are not configured on this server. Please contact our Bangalore store counter.');
        }
        throw new Error(json.error?.message || 'Failed to initiate subscription purchase order.');
      }

      setOrderData(json.data);
      launchRazorpayCheckout(json.data);
    } catch (err) {
      console.error('[PURCHASE INITIATION ERROR]', err.message);
      setPaymentError(err.message);
      setCurrentStep('FAILED');
    } finally {
      setProcessingOrder(false);
    }
  }

  // Dynamically load Razorpay SDK and trigger checkout modal
  function launchRazorpayCheckout(orderInfo) {
    function loadScript(src) {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    }

    loadScript('https://checkout.razorpay.com/v1/checkout.js').then((loaded) => {
      if (!loaded || !window.Razorpay) {
        setPaymentError('Failed to load secure Razorpay checkout gateway. Please check your connection.');
        setCurrentStep('FAILED');
        return;
      }

      const options = {
        key: orderInfo.keyId,
        amount: orderInfo.amountPaise,
        currency: orderInfo.currency || 'INR',
        name: 'PondFish Lake Catch',
        description: `Subscription: ${selectedPlan.title}`,
        order_id: orderInfo.orderId,
        prefill: {
          contact: customerMobile || '',
        },
        theme: {
          color: '#1e56a0',
        },
        handler: async function (response) {
          await verifySubscriptionPayment(response);
        },
        modal: {
          ondismiss: function () {
            setPaymentError('Subscription payment was not completed. You can retry the payment.');
            setCurrentStep('FAILED');
          },
        },
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (rzpErr) {
        console.error('[RAZORPAY OPEN ERROR]', rzpErr.message);
        setPaymentError(rzpErr.message || 'Unable to open payment modal.');
        setCurrentStep('FAILED');
      }
    });
  }

  // Step 4: Server-Side HMAC Signature Verification & Atomic Activation
  async function verifySubscriptionPayment(paymentResponse) {
    setProcessingOrder(true);
    setPaymentError('');

    try {
      const res = await fetch('/api/v1/customer/subscription/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          razorpayOrderId: paymentResponse.razorpay_order_id,
          razorpayPaymentId: paymentResponse.razorpay_payment_id,
          razorpaySignature: paymentResponse.razorpay_signature,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Payment verification failed on server.');
      }

      setActivationResult(json.data);
      setCurrentStep('SUCCESS');
    } catch (err) {
      console.error('[SERVER VERIFICATION ERROR]', err.message);
      setPaymentError(err.message || 'Subscription payment was not completed. You can retry the payment.');
      setCurrentStep('FAILED');
    } finally {
      setProcessingOrder(false);
    }
  }

  return (
    <div className="pf-subs-page">
      <div className="pf-container">
        {/* 1. Page Header Section */}
        <div className="pf-subs-header">
          <h1 className="pf-subs-title">
            Fresh Catch Subscription Plans
          </h1>
          <p className="pf-subs-subtitle">
            Subscriptions convert your upfront plan fee into PondFish Store Credit to spend on daily fresh lake harvest, combined with a weekly quantity allowance to reserve prime morning catches.
          </p>
        </div>

        {/* 2. Visual Direction Callout: Store Credit Concept Banner */}
        <div className="pf-subs-banner">
          <div className="pf-subs-banner-copy">
            <div className="pf-subs-banner-eyebrow">
              Store Credit &amp; Weekly Allowance
            </div>
            <h2 className="pf-subs-banner-title">
              Upfront Plan Fees Become PondFish Store Credit
            </h2>
            <p className="pf-subs-banner-desc">
              Subscriptions convert your upfront plan fee into PondFish Store Credit to spend on daily fresh lake harvest, combined with a weekly quantity allowance to reserve prime morning catches before walk-ins open.
            </p>
          </div>
          <div className="pf-subs-banner-stats">
            <div className="pf-subs-stat-card">
              <div className="pf-subs-stat-val green">Store Credit</div>
              <div className="pf-subs-stat-lbl">Account Balance</div>
            </div>
            <div className="pf-subs-stat-card">
              <div className="pf-subs-stat-val blue">Weekly Quota</div>
              <div className="pf-subs-stat-lbl">Weight Allowance</div>
            </div>
          </div>
        </div>

        {/* 3. Subscription Plans Grid */}
        {loading ? (
          <div className="pf-subs-plans-grid">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="pf-plan-card"
                style={{ height: '480px' }}
              >
                <div>
                  <div style={{ width: '120px', height: '24px', borderRadius: '6px', background: '#e2e8f0', marginBottom: '20px' }}></div>
                  <div style={{ width: '60%', height: '36px', borderRadius: '6px', background: '#e2e8f0', marginBottom: '12px' }}></div>
                  <div style={{ width: '85%', height: '16px', borderRadius: '6px', background: '#f1f5f9', marginBottom: '28px' }}></div>
                  <div style={{ width: '100%', height: '70px', borderRadius: '12px', background: '#f1f5f9', marginBottom: '24px' }}></div>
                </div>
                <div style={{ width: '100%', height: '48px', borderRadius: '12px', background: '#e2e8f0' }}></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Subscription Plans Unavailable"
            message={error}
            onRetry={fetchPlans}
          />
        ) : plans.length === 0 ? (
          <EmptyState
            title="No Subscription Plans Configured"
            message="Subscription plans are currently undergoing seasonal review. Please visit our Bangalore counter for walk-in fresh catch rates."
            actionLabel="Browse Fish Catalogue"
            onAction={() => window.location.href = '/#fish-availability'}
          />
        ) : (
          <div className="pf-subs-plans-grid">
            {plans.map((plan, idx) => {
              const isPopular = idx === 1 || plan.title?.toLowerCase().includes('priority');
              return (
                <div
                  key={plan.id}
                  className={`pf-plan-card ${isPopular ? 'featured' : ''}`}
                >
                  {isPopular && (
                    <div className="pf-plan-featured-badge">
                      MOST POPULAR
                    </div>
                  )}

                  <div>
                    {/* Plan Title */}
                    <h3 className="pf-plan-card-title">
                      {plan.title}
                    </h3>

                    {/* Price */}
                    <div className="pf-plan-card-pricing">
                      <span className="pf-plan-card-price">
                        ₹{plan.price.toLocaleString('en-IN')}
                      </span>
                      <span className="pf-plan-card-validity">
                        / {plan.validityDays} days validity
                      </span>
                    </div>

                    {/* Store Credit Box */}
                    <div className="pf-plan-credit-box">
                      <div className="pf-plan-credit-tag">
                        Monetary Store Credit
                      </div>
                      <div className="pf-plan-credit-amount">
                        Get ₹{plan.creditAmount.toLocaleString('en-IN')} Store Credit
                      </div>
                      <div className="pf-plan-credit-desc">
                        Full monetary balance credited to your store account to spend on fresh lake catch.
                      </div>
                    </div>

                    {/* Weekly Limits & Key Features List */}
                    <div className="pf-plan-perks">
                      <div className="pf-plan-perk-item">
                        <Check size={16} color="#159c57" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#0f2c59' }}>Weekly Reservation Quota:</strong>{' '}
                          <span style={{ color: '#475569' }}>Up to <strong style={{ color: '#1e56a0' }}>{plan.weeklyQtyLimitKg} kg/week</strong> priority reserve allowance.</span>
                        </div>
                      </div>

                      <div className="pf-plan-perk-item">
                        <Check size={16} color="#159c57" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#0f2c59' }}>Store Credit Balance:</strong>{' '}
                          <span style={{ color: '#475569' }}>Valid against all eligible daily fresh fish varieties at Bangalore counter.</span>
                        </div>
                      </div>

                      <div className="pf-plan-perk-item">
                        <Check size={16} color="#159c57" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#0f2c59' }}>07:00 AM Morning Truck Priority:</strong>{' '}
                          <span style={{ color: '#475569' }}>Lock in peak freshness before morning walk-in rush.</span>
                        </div>
                      </div>

                      <div className="pf-plan-perk-item">
                        <Check size={16} color="#159c57" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#0f2c59' }}>Validity Window:</strong>{' '}
                          <span style={{ color: '#475569' }}>Active for {plan.validityDays} days from server activation.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Purchase CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className="pf-plan-cta-btn"
                  >
                    <span>Subscribe to {plan.title}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. Educational Section: Weekly Allowance vs. Monetary Credit */}
        <div className="pf-subs-edu-card">
          <h2 className="pf-subs-edu-title">
            Understanding Your Subscription: Credit vs. Weekly Allowance
          </h2>
          <div className="pf-subs-edu-grid">
            <div className="pf-subs-edu-item">
              <h3 className="pf-subs-edu-item-heading">
                Monetary Store Credit (₹)
              </h3>
              <p className="pf-subs-edu-item-text">
                This is your stored rupee balance. When you collect or order fish, the itemized total is deducted from this credit balance. You pay zero extra unless your order exceeds this amount.
              </p>
            </div>

            <div className="pf-subs-edu-item">
              <h3 className="pf-subs-edu-item-heading">
                Weekly Allowance Quota (kg)
              </h3>
              <p className="pf-subs-edu-item-text">
                The weekly weight quota (e.g. 2 kg to 3 kg/week depending on plan) protects supply integrity. It allows home subscribers to reserve premium morning truck arrivals while preventing commercial hoarding.
              </p>
            </div>

            <div className="pf-subs-edu-item">
              <h3 className="pf-subs-edu-item-heading">
                Bank-Verified Security
              </h3>
              <p className="pf-subs-edu-item-text">
                Payments are executed via official Razorpay gateway with server-side HMAC-SHA256 signature verification. No subscription activates without confirmed bank settlement.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE PURCHASE & AUTH MODAL */}
      {modalOpen && selectedPlan && (
        <div className="pf-subs-modal-backdrop">
          <div className="pf-subs-modal-dialog">
            {/* Modal Close Button */}
            <button
              onClick={closeModal}
              aria-label="Close dialog"
              className="pf-subs-modal-close"
            >
              ✕
            </button>

            {/* FLOW STEP: AUTHENTICATION */}
            {currentStep === 'AUTH' && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e56a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                  Step 1 of 3 • Customer Verification
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0f2c59', marginBottom: '10px' }}>
                  Sign In to Subscribe
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', marginBottom: '24px' }}>
                  Subscriptions are associated with your PondFish customer profile to manage your store credit and booking quota.
                </p>

                {authError && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: '#b91c1c',
                    fontSize: '13px',
                    marginBottom: '20px',
                    lineHeight: '1.4'
                  }}>
                    {authError}
                  </div>
                )}

                {!showDirectToken ? (
                  <div>
                    <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f2c59', marginBottom: '6px' }}>
                          Mobile Number
                        </label>
                        <div style={{ display: 'flex' }}>
                          <span style={{
                            padding: '10px 14px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRight: 'none',
                            borderRadius: '10px 0 0 10px',
                            color: '#475569',
                            fontSize: '14px',
                            fontWeight: '700'
                          }}>
                            +91
                          </span>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="9876543210"
                            value={customerMobile}
                            onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                            disabled={otpSent}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0 10px 10px 0',
                              color: '#0f2c59',
                              fontSize: '14px',
                              fontWeight: '600',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      {otpSent && (
                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f2c59', marginBottom: '6px' }}>
                            Verification OTP Code / ID Token
                          </label>
                          <input
                            type="text"
                            placeholder="Enter 6-digit OTP or token"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '10px',
                              color: '#0f2c59',
                              fontSize: '14px',
                              fontWeight: '600',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                            OTP dispatch logged to PondFish auth service.
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="pf-btn-primary"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          borderRadius: '10px',
                          padding: '12px 20px',
                          fontSize: '14px',
                          opacity: authLoading ? 0.7 : 1,
                          marginBottom: '16px'
                        }}
                      >
                        {authLoading ? 'Verifying...' : otpSent ? 'Verify OTP & Continue' : 'Request OTP Code'}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setShowDirectToken(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#1e56a0',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        width: '100%',
                        textDecoration: 'underline'
                      }}
                    >
                      Already have an active session token? Enter directly
                    </button>
                  </div>
                ) : (
                  <div>
                    <form onSubmit={handleApplyDirectToken}>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f2c59', marginBottom: '6px' }}>
                          Customer Session Token (Bearer JWT)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Paste PondFish customer session token..."
                          value={directTokenInput}
                          onChange={(e) => setDirectTokenInput(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '10px',
                            color: '#0f2c59',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            outline: 'none',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        className="pf-btn-primary"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          borderRadius: '10px',
                          padding: '12px 20px',
                          fontSize: '14px',
                          marginBottom: '16px'
                        }}
                      >
                        <span>Use Customer Session</span>
                        <ArrowRight size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDirectToken(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          textAlign: 'center',
                          width: '100%'
                        }}
                      >
                        &larr; Back to Mobile Phone Sign In
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* FLOW STEP: REVIEW ORDER & ACCEPT TERMS */}
            {currentStep === 'REVIEW' && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e56a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                  Step 2 of 3 • Review &amp; Confirm
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0f2c59', marginBottom: '16px' }}>
                  Review Subscription Order
                </h3>

                {/* Plan Summary Card */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>Selected Plan:</span>
                    <strong style={{ fontSize: '15px', color: '#0f2c59' }}>{selectedPlan.title}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>Payable Amount:</span>
                    <strong style={{ fontSize: '16px', color: '#1e56a0' }}>₹{selectedPlan.price.toLocaleString('en-IN')}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>PondFish Store Credit:</span>
                    <strong style={{ fontSize: '15px', color: '#159c57' }}>₹{selectedPlan.creditAmount.toLocaleString('en-IN')}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>Weekly Reservation Quota:</span>
                    <strong style={{ fontSize: '14px', color: '#0f2c59' }}>{selectedPlan.weeklyQtyLimitKg} kg/week</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>Plan Validity:</span>
                    <strong style={{ fontSize: '14px', color: '#0f2c59' }}>{selectedPlan.validityDays} Days</strong>
                  </div>
                </div>

                {/* Visible Terms Before Purchase */}
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px',
                  fontSize: '12.5px',
                  color: '#1e40af',
                  lineHeight: '1.6'
                }}>
                  <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '6px' }}>
                    Membership Terms &amp; Rules:
                  </strong>
                  <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', margin: 0 }}>
                    <li>100% of ₹{selectedPlan.price} is credited to your customer store wallet upon verified payment.</li>
                    <li>Weekly limit of {selectedPlan.weeklyQtyLimitKg} kg resets every week to guarantee fair catch distribution.</li>
                    <li>Payments are securely processed via Razorpay. Activations occur immediately upon bank confirmation.</li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <button
                  onClick={handleProceedToPayment}
                  disabled={processingOrder}
                  className="pf-btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    fontSize: '15px',
                    opacity: processingOrder ? 0.7 : 1,
                    marginBottom: '12px'
                  }}
                >
                  <span>{processingOrder ? 'Generating Razorpay Order...' : `Proceed to Pay ₹${selectedPlan.price.toLocaleString('en-IN')}`}</span>
                  {!processingOrder && <ArrowRight size={16} />}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('pondfish_customer_token');
                      }
                      setCustomerToken('');
                      setCurrentStep('AUTH');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Switch Account / Sign Out
                  </button>

                  <button
                    onClick={closeModal}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* FLOW STEP: PAYMENT FAILED / CANCELLED */}
            {currentStep === 'FAILED' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    margin: '0 auto 16px',
                    fontWeight: '800'
                  }}>
                    ✕
                  </div>
                  <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0f2c59', marginBottom: '8px' }}>
                    Payment Incomplete
                  </h3>
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    padding: '16px',
                    color: '#991b1b',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    marginBottom: '16px'
                  }}>
                    <p style={{ margin: 0, fontWeight: '700' }}>
                      Subscription payment was not completed.
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#b91c1c' }}>
                      You can retry the payment.
                    </p>
                  </div>
                  {paymentError && paymentError !== 'Subscription payment was not completed. You can retry the payment.' && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                      Server note: {paymentError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => {
                      setCurrentStep('REVIEW');
                      setPaymentError('');
                    }}
                    className="pf-btn-primary"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      borderRadius: '10px',
                      padding: '12px 20px',
                      fontSize: '14px'
                    }}
                  >
                    Retry Payment
                  </button>
                  <button
                    onClick={closeModal}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      background: '#f1f5f9',
                      color: '#475569',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* FLOW STEP: ACTIVATION SUCCESS */}
            {currentStep === 'SUCCESS' && activationResult && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#159c57',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    margin: '0 auto 16px',
                    fontWeight: '800'
                  }}>
                    ✓
                  </div>
                  <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0f2c59', marginBottom: '8px' }}>
                    Subscription Activated!
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
                    Your subscription to <strong style={{ color: '#0f2c59' }}>{selectedPlan.title}</strong> is now verified and active. ₹{parseFloat(activationResult.ledger?.resulting_balance || selectedPlan.creditAmount).toLocaleString('en-IN')} Store Credit has been credited to your account balance.
                  </p>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Available Store Credit:</span>
                    <strong style={{ fontSize: '16px', color: '#159c57' }}>
                      ₹{parseFloat(activationResult.ledger?.resulting_balance || selectedPlan.creditAmount).toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Weekly Reservation Quota:</span>
                    <strong style={{ fontSize: '14px', color: '#1e56a0' }}>
                      {selectedPlan.weeklyQtyLimitKg} kg/week
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Status:</span>
                    <span style={{
                      background: '#ecfdf5',
                      color: '#047857',
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      border: '1px solid #a7f3d0'
                    }}>
                      ACTIVE
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Active Expiry:</span>
                    <span style={{ fontSize: '13px', color: '#0f2c59', fontWeight: '700' }}>
                      {activationResult.subscription?.expires_at
                        ? new Date(activationResult.subscription.expires_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : `${selectedPlan.validityDays} days from today`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link
                    href="/#fish-availability"
                    onClick={closeModal}
                    className="pf-btn-primary"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      borderRadius: '12px',
                      padding: '12px 20px',
                      fontSize: '14px'
                    }}
                  >
                    <span>Browse Fresh Catch &amp; Reserve</span>
                    <ArrowRight size={14} />
                  </Link>

                  <button
                    onClick={closeModal}
                    style={{
                      padding: '12px 20px',
                      background: '#f1f5f9',
                      color: '#475569',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '700',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
