<?php
// Document assets loader from authentic Assurance Media PDF templates
function get_document_assets() {
    static $assets = null;
    if ($assets === null) {
        $jsonPath = __DIR__ . '/document_assets.json';
        if (!file_exists($jsonPath)) {
            $jsonPath = __DIR__ . '/../../frontend/public/assets/documents/document_assets.json';
        }
        if (file_exists($jsonPath)) {
            $assets = json_decode(file_get_contents($jsonPath), true);
        } else {
            $assets = [];
        }
    }
    return $assets;
}
