/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const LOGO_URL = 'https://upwzxjjeiuphlqsyztvm.supabase.co/storage/v1/object/public/email-assets/logo-shinely.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu email — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="Shinely" width="120" height="40" style={logo} />
        <Heading style={h1}>Bem-vindo(a) ao Shinely! ✨</Heading>
        <Text style={text}>
          Que bom ter você aqui! Confirme seu email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) para começar a usar o{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar Email
        </Button>
        <Text style={footer}>
          Se você não criou uma conta, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const logo = { margin: '0 0 24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#2D1A4E',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#6B5280',
  lineHeight: '1.6',
  margin: '0 0 28px',
}
const link = { color: '#A855F7', textDecoration: 'underline' }
const button = {
  backgroundColor: '#A855F7',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
