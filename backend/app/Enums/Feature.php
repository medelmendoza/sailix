<?php

namespace App\Enums;

/**
 * Core features the platform can switch off for one organization. They are on by default (unlike modules, which are
 * provisioned), and off hides them in the web portal and mobile app and makes the API refuse them (`feature:<code>`).
 */
enum Feature: string
{
    case Crew = 'crew';
    case Documents = 'documents';
    case Announcements = 'announcements';
    case Finance = 'finance';
    case Feedback = 'feedback';
    case Todos = 'todos';
    case Branding = 'branding';

    public function label(): string
    {
        return match ($this) {
            self::Crew => 'Crew',
            self::Documents => 'Documents',
            self::Announcements => 'Announcements',
            self::Finance => 'Payslips and loans',
            self::Feedback => 'Feedback',
            self::Todos => 'To-dos',
            self::Branding => 'Branding and domains',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Crew => 'Crew list and profiles in the admin portal.',
            self::Documents => 'Document types, crew documents and requests for documents.',
            self::Announcements => 'Announcements to crew, with files.',
            self::Finance => 'Payroll import in the portal; payslips and loans in the app.',
            self::Feedback => 'Feedback sent from the app and read in the portal.',
            self::Todos => 'To-dos for crew.',
            self::Branding => 'The organization changing its own look and addresses (the platform still can).',
        };
    }
}
