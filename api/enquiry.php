<?php

declare(strict_types=1);

const AVERIS_HUBSPOT_ENDPOINT = 'https://api.hsforms.com/submissions/v3/integration/submit/247101468/c0c292e7-d336-4603-956b-e3e30d154002';
const AVERIS_CONTACT_PAGE = 'https://averisdigital.net/contact.html';
const AVERIS_MAX_REQUEST_BYTES = 20000;

/**
 * @return array{status: int, body: array<string, mixed>}
 */
function averis_handle_enquiry(string $method, string $rawBody, array $server, callable $forwarder): array
{
    if (strtoupper($method) !== 'POST') {
        return averis_result(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    if (strlen($rawBody) > AVERIS_MAX_REQUEST_BYTES) {
        return averis_result(413, ['ok' => false, 'message' => 'Request is too large.']);
    }

    try {
        $data = json_decode($rawBody, true, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        return averis_result(400, ['ok' => false, 'message' => 'Invalid JSON request.']);
    }

    if (!is_array($data)) {
        return averis_result(400, ['ok' => false, 'message' => 'Invalid request.']);
    }

    if (averis_text($data['company_website'] ?? '') !== '') {
        return averis_result(200, ['ok' => true]);
    }

    $name = averis_text($data['name'] ?? '');
    $email = averis_text($data['email'] ?? '');
    $company = averis_text($data['company'] ?? '');
    $topic = averis_text($data['topic'] ?? '');
    $message = averis_text($data['message'] ?? '');

    $errors = averis_validate_enquiry($name, $email, $company, $topic, $message);
    if ($errors !== []) {
        return averis_result(422, ['ok' => false, 'errors' => $errors]);
    }

    [$firstName, $lastName] = averis_split_name($name);
    $hubspotMessage = $message;
    if ($company !== '') {
        $hubspotMessage .= "\n\nCompany: {$company}";
    }
    if ($topic !== '') {
        $hubspotMessage .= "\nArea: {$topic}";
    }

    $fields = [
        averis_hubspot_field('firstname', $firstName),
        averis_hubspot_field('email', $email),
        averis_hubspot_field('message', $hubspotMessage),
    ];
    if ($lastName !== '') {
        $fields[] = averis_hubspot_field('lastname', $lastName);
    }

    $meta = is_array($data['meta'] ?? null) ? $data['meta'] : [];
    $pageUri = averis_page_uri($meta['pageUrl'] ?? null);
    $context = [
        'pageName' => 'Contact — Averis Digital OÜ',
        'pageUri' => $pageUri,
    ];
    $remoteAddress = averis_text($server['REMOTE_ADDR'] ?? '');
    if (filter_var($remoteAddress, FILTER_VALIDATE_IP)) {
        $context['ipAddress'] = $remoteAddress;
    }

    $hubspotPayload = [
        'fields' => $fields,
        'submittedAt' => (string) round(microtime(true) * 1000),
        'context' => $context,
    ];

    try {
        $upstream = $forwarder(AVERIS_HUBSPOT_ENDPOINT, $hubspotPayload);
    } catch (Throwable $error) {
        error_log('Averis HubSpot enquiry transport failed: ' . $error->getMessage());
        return averis_result(502, ['ok' => false, 'message' => 'Unable to send the enquiry.']);
    }

    $upstreamStatus = (int) ($upstream['status'] ?? 0);
    if ($upstreamStatus < 200 || $upstreamStatus >= 300) {
        error_log('Averis HubSpot enquiry rejected with status ' . $upstreamStatus);
        return averis_result(502, ['ok' => false, 'message' => 'Unable to send the enquiry.']);
    }

    return averis_result(200, ['ok' => true]);
}

/** @return array{status: int, body: array<string, mixed>} */
function averis_result(int $status, array $body): array
{
    return ['status' => $status, 'body' => $body];
}

function averis_text(mixed $value): string
{
    return is_string($value) ? trim($value) : '';
}

/** @return array<string, string> */
function averis_validate_enquiry(string $name, string $email, string $company, string $topic, string $message): array
{
    $errors = [];

    if ($name === '') {
        $errors['name'] = 'Please enter your name.';
    } elseif (strlen($name) > 120) {
        $errors['name'] = 'Please use a shorter name.';
    }

    if ($email === '') {
        $errors['email'] = 'Please enter your email address.';
    } elseif (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Please enter a valid email address.';
    }

    if (strlen($company) > 160) {
        $errors['company'] = 'Please use a shorter company name.';
    }

    if (strlen($topic) > 120) {
        $errors['topic'] = 'Please select a valid area.';
    }

    if ($message === '') {
        $errors['message'] = 'Please tell us a little about your project.';
    } elseif (strlen($message) > 5000) {
        $errors['message'] = 'Please keep your message under 5,000 characters.';
    }

    return $errors;
}

/** @return array{0: string, 1: string} */
function averis_split_name(string $name): array
{
    $parts = preg_split('/\s+/', trim($name), 2);
    if (!is_array($parts) || $parts === []) {
        return ['', ''];
    }
    return [$parts[0], $parts[1] ?? ''];
}

/** @return array{objectTypeId: string, name: string, value: string} */
function averis_hubspot_field(string $name, string $value): array
{
    return ['objectTypeId' => '0-1', 'name' => $name, 'value' => $value];
}

function averis_page_uri(mixed $value): string
{
    $uri = averis_text($value);
    if ($uri === '' || !filter_var($uri, FILTER_VALIDATE_URL)) {
        return AVERIS_CONTACT_PAGE;
    }

    $scheme = strtolower((string) parse_url($uri, PHP_URL_SCHEME));
    return in_array($scheme, ['http', 'https'], true) ? $uri : AVERIS_CONTACT_PAGE;
}

/** @return array{status: int, body: string} */
function averis_forward_to_hubspot(string $url, array $payload): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is required.');
    }

    $handle = curl_init($url);
    if ($handle === false) {
        throw new RuntimeException('Could not initialize the HubSpot request.');
    }

    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
    ]);

    $body = curl_exec($handle);
    if ($body === false) {
        $message = curl_error($handle);
        curl_close($handle);
        throw new RuntimeException($message !== '' ? $message : 'HubSpot request failed.');
    }

    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    return ['status' => $status, 'body' => (string) $body];
}

if (!defined('AVERIS_ENQUIRY_TEST_MODE')) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (strtoupper($method) !== 'POST') {
        header('Allow: POST');
    }

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > AVERIS_MAX_REQUEST_BYTES) {
        $response = averis_result(413, ['ok' => false, 'message' => 'Request is too large.']);
    } else {
        $rawBody = file_get_contents(
            'php://input',
            false,
            null,
            0,
            AVERIS_MAX_REQUEST_BYTES + 1
        );
        $response = averis_handle_enquiry(
            $method,
            is_string($rawBody) ? $rawBody : '',
            $_SERVER,
            'averis_forward_to_hubspot'
        );
    }

    http_response_code($response['status']);
    echo json_encode($response['body'], JSON_UNESCAPED_SLASHES);
}
