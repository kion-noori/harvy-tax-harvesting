import React, { useState, useEffect, useRef } from 'react';
import { request } from 'sats-connect';

// Default the prop to a no-op so missing props won't crash the app.
function BitcoinWalletButton({ onAddressChange = () => {} }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [btcAddress, setBtcAddress] = useState('');
  const dropdownRef = useRef(null);

  const connectXverse = async () => {
    try {
      setIsConnecting(true);
      const response = await request('wallet_connect', {
        addresses: ['ordinals'],
        message: 'Connect your wallet to view your Ordinals',
      });

      if (response.status === 'success') {
        const ordinalsAddressItem = response.result.addresses.find(
          (address) => address.purpose === 'ordinals'
        );

        if (ordinalsAddressItem) {
          const addr = ordinalsAddressItem.address;
          setBtcAddress(addr);
          // Guard the call, even though we default the prop
          if (typeof onAddressChange === 'function') onAddressChange(addr);

          // DO NOT store in localStorage - require fresh wallet approval each session
          // This ensures users always go through proper wallet authentication
        }
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      // Properly disconnect from wallet to revoke permissions
      await request('wallet_disconnect', {});
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Wallet disconnected and permissions revoked');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Disconnect error (may not be critical):', error);
      }
    }

    // Clear state
    setBtcAddress('');
    if (typeof onAddressChange === 'function') onAddressChange('');
    setIsDropdownVisible(false);
  };

  // Component mount - no auto-connect from localStorage
  // User must explicitly click "Connect Bitcoin" to trigger wallet connection
  useEffect(() => {
    // DO NOT auto-load from localStorage
    // This ensures users always explicitly connect via the button
    // which triggers the proper wallet authentication flow
  }, []);

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsDropdownVisible(!isDropdownVisible);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownVisible(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="custom-wallet-button-container" ref={dropdownRef} style={{ position: 'relative' }}>
      {!btcAddress ? (
        <button
          onClick={connectXverse}
          disabled={isConnecting}
          style={{
            background: 'linear-gradient(135deg, #F7931A 0%, #FF6B35 100%)',
            padding: '0 24px',
            height: '48px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            color: 'white',
            fontFamily: 'DM Sans, Roboto, Helvetica Neue, sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(247, 147, 26, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(247, 147, 26, 0.3)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="#F7931A"/>
            <path d="M17.0328 10.4717C17.2276 8.83352 15.9563 7.9535 14.2134 7.3707L14.7244 5.19547L13.4097 4.89001L12.9127 7.01242C12.5658 6.92835 12.2108 6.84845 11.8587 6.76872L12.3599 4.63112L11.0461 4.32566L10.535 6.50071C10.2451 6.43643 9.96157 6.37352 9.68712 6.30768L9.68856 6.30101L7.91149 5.87818L7.58587 7.25679C7.58587 7.25679 8.53833 7.47541 8.5168 7.48915C9.04303 7.61303 9.13009 7.96226 9.11545 8.24103L8.52999 10.7264C8.56528 10.7358 8.61106 10.7495 8.66154 10.7723L8.52833 10.7373L7.73175 14.0896C7.67322 14.2394 7.52458 14.4573 7.15618 14.3717C7.16962 14.3911 6.22435 14.1374 6.22435 14.1374L5.6 15.6165L7.28569 16.0187C7.60442 16.0972 7.91636 16.1797 8.22325 16.2567L7.70621 18.4591L9.01822 18.7645L9.52932 16.5888C9.88912 16.6865 10.2377 16.7758 10.579 16.8606L10.0702 19.0245L11.385 19.33L11.902 17.1321C14.2001 17.5717 15.9223 17.3808 16.7161 15.2951C17.3525 13.6074 16.7809 12.6535 15.6261 12.0296C16.4709 11.8408 17.1131 11.2813 17.0328 10.4717ZM14.3584 14.3375C13.9073 16.0254 11.2555 15.2307 10.2994 15.0017L10.9938 12.0669C11.9499 12.297 14.826 12.5769 14.3584 14.3375ZM14.8095 10.4455C14.3983 11.9879 12.1825 11.318 11.3886 11.1285L12.0143 8.4654C12.8082 8.65485 15.2366 8.83657 14.8095 10.4455Z" fill="white"/>
          </svg>
          {isConnecting ? 'Connecting...' : 'Connect Bitcoin'}
        </button>
      ) : (
        <>
          <button
            onClick={toggleDropdown}
            style={{
              background: 'linear-gradient(135deg, #F7931A 0%, #FF6B35 100%)',
              padding: '0 24px',
              height: '48px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              color: 'white',
              fontFamily: 'DM Sans, Roboto, Helvetica Neue, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(247, 147, 26, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(247, 147, 26, 0.3)';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="#F7931A"/>
              <path d="M17.0328 10.4717C17.2276 8.83352 15.9563 7.9535 14.2134 7.3707L14.7244 5.19547L13.4097 4.89001L12.9127 7.01242C12.5658 6.92835 12.2108 6.84845 11.8587 6.76872L12.3599 4.63112L11.0461 4.32566L10.535 6.50071C10.2451 6.43643 9.96157 6.37352 9.68712 6.30768L9.68856 6.30101L7.91149 5.87818L7.58587 7.25679C7.58587 7.25679 8.53833 7.47541 8.5168 7.48915C9.04303 7.61303 9.13009 7.96226 9.11545 8.24103L8.52999 10.7264C8.56528 10.7358 8.61106 10.7495 8.66154 10.7723L8.52833 10.7373L7.73175 14.0896C7.67322 14.2394 7.52458 14.4573 7.15618 14.3717C7.16962 14.3911 6.22435 14.1374 6.22435 14.1374L5.6 15.6165L7.28569 16.0187C7.60442 16.0972 7.91636 16.1797 8.22325 16.2567L7.70621 18.4591L9.01822 18.7645L9.52932 16.5888C9.88912 16.6865 10.2377 16.7758 10.579 16.8606L10.0702 19.0245L11.385 19.33L11.902 17.1321C14.2001 17.5717 15.9223 17.3808 16.7161 15.2951C17.3525 13.6074 16.7809 12.6535 15.6261 12.0296C16.4709 11.8408 17.1131 11.2813 17.0328 10.4717ZM14.3584 14.3375C13.9073 16.0254 11.2555 15.2307 10.2994 15.0017L10.9938 12.0669C11.9499 12.297 14.826 12.5769 14.3584 14.3375ZM14.8095 10.4455C14.3983 11.9879 12.1825 11.318 11.3886 11.1285L12.0143 8.4654C12.8082 8.65485 15.2366 8.83657 14.8095 10.4455Z" fill="white"/>
            </svg>
            {btcAddress.slice(0, 4)}...{btcAddress.slice(-4)}
          </button>

          {isDropdownVisible && (
            <div
              className="custom-dropdown-menu"
              style={{
                position: 'absolute',
                zIndex: 999,
                top: '100%',
                right: 0,
                marginTop: '10px',
                background: '#2c2d30',
                borderRadius: '10px',
                boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.6)',
                minWidth: '240px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <button
                onClick={() => {
                  navigator.clipboard.writeText(btcAddress);
                  setIsDropdownVisible(false);
                }}
                style={{
                  background: '#1a1f2e',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  padding: '0 20px',
                  borderRadius: '6px',
                  height: '37px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  width: '100%',
                }}
              >
                Copy Address
              </button>

              <button
                onClick={() => {
                  window.open(`https://mempool.space/address/${btcAddress}`, '_blank');
                  setIsDropdownVisible(false);
                }}
                style={{
                  background: '#1a1f2e',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  padding: '0 20px',
                  borderRadius: '6px',
                  height: '37px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  width: '100%',
                }}
              >
                View on Explorer
              </button>

              <button
                onClick={disconnect}
                style={{
                  background: '#1a1f2e',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  padding: '0 20px',
                  borderRadius: '6px',
                  height: '37px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  width: '100%',
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BitcoinWalletButton;
