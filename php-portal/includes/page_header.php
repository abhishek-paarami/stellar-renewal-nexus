<?php
/**
 * Render the standard page header.
 *   render_page_header('Clients', 'Master directory ...', '<button>...</button>');
 */
function render_page_header(string $title, string $description = '', string $actionsHtml = ''): void {
    echo '<div class="page-hd">';
    echo '<div><h1 class="page-hd__title">' . e($title) . '</h1>';
    if ($description !== '') echo '<p class="page-hd__desc">' . e($description) . '</p>';
    echo '</div>';
    if ($actionsHtml !== '') echo '<div class="page-hd__actions">' . $actionsHtml . '</div>';
    echo '</div>';
}