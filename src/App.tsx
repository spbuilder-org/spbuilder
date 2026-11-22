import React from 'react';
import '@arco-design/web-react/dist/css/arco.css';
import { Button, ConfigProvider, Divider, Layout, Link, Modal, Space, Typography } from '@arco-design/web-react';
import { IconApps, IconBook, IconCheckCircle, IconEmail, IconHome, IconPen, IconQuestionCircle } from '@arco-design/web-react/icon';
import enUS from '@arco-design/web-react/es/locale/en-US';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MainForm } from './component/mainForm';
import { DATA_ANALYSIS_ROUTE } from './config/dataAnalysis';
import { USER_MANUAL_ROUTE } from './config/userManual';
import { DataAnalysisPage } from './pages/DataAnalysis/DataAnalysisPage';
import { UserManualPage } from './pages/UserManual/UserManualPage';
import cite from './data/cite';
import './App.css';
import { UsageSettings } from './analytics/UsageSettings';

const { Title, Paragraph } = Typography;

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return `app-nav-link${isActive ? ' active' : ''}`;
}

function AppShell() {
  const location = useLocation();
  const [isCiteModalVisible, setIsCiteModalVisible] = React.useState(false);
  const [isCiteCopied, setIsCiteCopied] = React.useState(false);
  const [isContactModalVisible, setIsContactModalVisible] = React.useState(false);
  
  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Standard way to trigger a confirmation dialog across browsers
      event.preventDefault();
      event.returnValue = ''; 
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const isFullWidthPage =
    location.pathname === DATA_ANALYSIS_ROUTE || location.pathname === USER_MANUAL_ROUTE;
  const layoutStyle = isFullWidthPage
    ? { maxWidth: '100%' as const, margin: '0 auto', width: '100%' }
    : { maxWidth: 1080, margin: '0 auto' };

  return (
    <div className="App">
      <Modal
        visible={isCiteModalVisible}
        onCancel={() => setIsCiteModalVisible(false)}
        footer={null}
      >
        <Paragraph>
          The SP-Builder web application is licensed under
          <Link href="http://creativecommons.org/licenses/by-nc-nd/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style={{ display: 'inline-block' }}>
            <Space size='mini'>
              CC BY-NC-ND 4.0
              <img style={{ height: '1em', display: 'block', margin: 'auto' }} src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt="" />
              <img style={{ height: '1em', display: 'block', margin: 'auto' }} src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt="" />
              <img style={{ height: '1em', display: 'block', margin: 'auto' }} src="https://mirrors.creativecommons.org/presskit/icons/nc.svg?ref=chooser-v1" alt="" />
              <img style={{ height: '1em', display: 'block', margin: 'auto' }} src="https://mirrors.creativecommons.org/presskit/icons/nd.svg?ref=chooser-v1" alt="" />
            </Space>
          </Link>
        </Paragraph>
        <Title heading={6}>How to cite us</Title>
        <Paragraph style={{ fontFamily: '"Times New Roman", serif' }}>
          {cite}
        </Paragraph>
        <Button
          type='secondary'
          size='small'
          icon={isCiteCopied ? <IconCheckCircle /> : null}
          status={isCiteCopied ? 'success' : undefined}
          onClick={() => { navigator.clipboard.writeText(cite); setIsCiteCopied(true); }}
        >
          {isCiteCopied ? 'Copied' : 'Copy citation'}
        </Button>
      </Modal>
      <Modal
        visible={isContactModalVisible}
        onCancel={() => setIsContactModalVisible(false)}
        footer={null}
      >
        <Paragraph>
          Please send email to <Link href='mailto://spbuilder.team@gmail.com' target='_blank'>spbuilder.team@gmail.com</Link>
        </Paragraph>
      </Modal>
      <Layout style={layoutStyle}>
        <Layout.Header>
          <h1>Sequential Priming Builder</h1>
          <Space split={<Divider type='vertical' />} style={{ marginBottom: 30 }}>
            <NavLink to="/" end className={navLinkClassName}>
              <IconHome style={{ fontSize: 14 }} />
              Experiment Editor
            </NavLink>
            <NavLink to={DATA_ANALYSIS_ROUTE} className={navLinkClassName}>
              <IconApps style={{ fontSize: 14 }} />
              Data Analysis
            </NavLink>
            <NavLink to={USER_MANUAL_ROUTE} className={navLinkClassName}>
              <IconBook style={{ fontSize: 14 }} />
              User Manual
            </NavLink>
            <Link href='./SP-Builder_FAQ.pdf' target='_blank' icon={<IconQuestionCircle />}>
              FAQ
            </Link>
            <Link icon={<IconPen />} onClick={() => { setIsCiteModalVisible(true); setIsCiteCopied(false); }}>
              How to cite us
            </Link>
            <Link icon={<IconEmail />} onClick={() => setIsContactModalVisible(true)}>
              Contact us
            </Link>
          </Space>
        </Layout.Header>
        <Layout.Content>
          <Routes>
            <Route path="/" element={<MainForm />} />
            <Route path={DATA_ANALYSIS_ROUTE} element={<DataAnalysisPage />} />
            <Route path={USER_MANUAL_ROUTE} element={<UserManualPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout.Content>
        <UsageSettings path={location.pathname} />
      </Layout>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <ConfigProvider locale={enUS}>
        <AppShell />
      </ConfigProvider>
    </HashRouter>
  );
}

export default App;
