
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "auto_confirm_until": string | null,"id": boolean,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_confirm_until"?: string | null,"id"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "auto_confirm_until"?: string | null,"id"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "code": string,"id": string,"name": string,"scope": Database["public"]['Enums']["category_scope"],"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: string,"name": string,"scope"?: Database["public"]['Enums']["category_scope"],"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"id"?: string,"name"?: string,"scope"?: Database["public"]['Enums']["category_scope"],"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"club_managers": {
                  Row: {
                    "club_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_managers_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_managers_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "public_clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_managers_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["club_id"]
    },{
      foreignKeyName: "club_managers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_managers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "city": string | null,"created_at": string,"id": string,"name": string,"region": Database["public"]['Enums']["region"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"name": string,"region"?: Database["public"]['Enums']["region"] | null
                  }
                  Update: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"region"?: Database["public"]['Enums']["region"] | null
                  }
                  Relationships: [
                    
                  ]
                },"external_clubs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_clubs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "external_clubs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"game_officials": {
                  Row: {
                    "game_id": string,"id": string,"nominated_at": string,"nominated_by": string | null,"position": Database["public"]['Enums']["official_position"],"reason": string | null,"responded_at": string | null,"status": Database["public"]['Enums']["nomination_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"id"?: string,"nominated_at"?: string,"nominated_by"?: string | null,"position": Database["public"]['Enums']["official_position"],"reason"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["nomination_status"],"user_id": string
                  }
                  Update: {
                    "game_id"?: string,"id"?: string,"nominated_at"?: string,"nominated_by"?: string | null,"position"?: Database["public"]['Enums']["official_position"],"reason"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["nomination_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_officials_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_officials_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "public_games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_officials_nominated_by_fkey"
      columns: ["nominated_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_officials_nominated_by_fkey"
      columns: ["nominated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_officials_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_officials_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "away_external": string | null,"away_label": string | null,"away_score": number | null,"away_team_id": string | null,"category_id": string | null,"competition": Database["public"]['Enums']["game_competition"],"created_at": string,"created_by": string | null,"group_id": string | null,"gym_id": string | null,"home_external": string | null,"home_label": string | null,"home_score": number | null,"home_team_id": string | null,"id": string,"label": string | null,"region": Database["public"]['Enums']["region"] | null,"scoresheet": string | null,"starts_at": string,"status": Database["public"]['Enums']["game_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "away_external"?: string | null,"away_label"?: string | null,"away_score"?: number | null,"away_team_id"?: string | null,"category_id"?: string | null,"competition"?: Database["public"]['Enums']["game_competition"],"created_at"?: string,"created_by"?: string | null,"group_id"?: string | null,"gym_id"?: string | null,"home_external"?: string | null,"home_label"?: string | null,"home_score"?: number | null,"home_team_id"?: string | null,"id"?: string,"label"?: string | null,"region"?: Database["public"]['Enums']["region"] | null,"scoresheet"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["game_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "away_external"?: string | null,"away_label"?: string | null,"away_score"?: number | null,"away_team_id"?: string | null,"category_id"?: string | null,"competition"?: Database["public"]['Enums']["game_competition"],"created_at"?: string,"created_by"?: string | null,"group_id"?: string | null,"gym_id"?: string | null,"home_external"?: string | null,"home_label"?: string | null,"home_score"?: number | null,"home_team_id"?: string | null,"id"?: string,"label"?: string | null,"region"?: Database["public"]['Enums']["region"] | null,"scoresheet"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["game_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_away_team_id_fkey"
      columns: ["away_team_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "games_away_team_id_fkey"
      columns: ["away_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["category_id"]
    },{
      foreignKeyName: "games_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "public_groups"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "games_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_home_team_id_fkey"
      columns: ["home_team_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "games_home_team_id_fkey"
      columns: ["home_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_teams": {
                  Row: {
                    "group_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"team_id": string
                  }
                  Update: {
                    "group_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "public_groups"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "group_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "group_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "confirmed_proposal_id": string | null,"id": string,"name": string,"notes": string | null,"region": Database["public"]['Enums']["region"] | null,"sort_order": number,"tournament_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_proposal_id"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"region"?: Database["public"]['Enums']["region"] | null,"sort_order"?: number,"tournament_id": string
                  }
                  Update: {
                    "confirmed_proposal_id"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"region"?: Database["public"]['Enums']["region"] | null,"sort_order"?: number,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_confirmed_proposal_fk"
      columns: ["confirmed_proposal_id"]
isOneToOne: false
      referencedRelation: "hosting_proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "groups_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["tournament_id"]
    },{
      foreignKeyName: "groups_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"gyms": {
                  Row: {
                    "address": string | null,"city": string,"created_at": string,"created_by": string | null,"id": string,"maps_url": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"maps_url"?: string | null,"name": string
                  }
                  Update: {
                    "address"?: string | null,"city"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"maps_url"?: string | null,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gyms_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gyms_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hosting_proposals": {
                  Row: {
                    "auto_confirmed": boolean,"conditions_accepted_at": string,"conditions_text": string,"confirmed_by_admin": boolean,"created_at": string,"end_date": string | null,"group_id": string,"gym_id": string,"id": string,"notes": string | null,"proposed_by": string | null,"start_date": string,"status": Database["public"]['Enums']["proposal_status"],"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_confirmed"?: boolean,"conditions_accepted_at"?: string,"conditions_text": string,"confirmed_by_admin"?: boolean,"created_at"?: string,"end_date"?: string | null,"group_id": string,"gym_id": string,"id"?: string,"notes"?: string | null,"proposed_by"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["proposal_status"],"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "auto_confirmed"?: boolean,"conditions_accepted_at"?: string,"conditions_text"?: string,"confirmed_by_admin"?: boolean,"created_at"?: string,"end_date"?: string | null,"group_id"?: string,"gym_id"?: string,"id"?: string,"notes"?: string | null,"proposed_by"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["proposal_status"],"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hosting_proposals_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "hosting_proposals_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hosting_proposals_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "public_groups"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "hosting_proposals_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hosting_proposals_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hosting_proposals_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hosting_proposals_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "hosting_proposals_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"impersonation_log": {
                  Row: {
                    "admin_email": string,"admin_id": string | null,"ended_at": string | null,"id": string,"started_at": string,"target_email": string,"target_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_email": string,"admin_id"?: string | null,"ended_at"?: string | null,"id"?: string,"started_at"?: string,"target_email": string,"target_id"?: string | null
                  }
                  Update: {
                    "admin_email"?: string,"admin_id"?: string | null,"ended_at"?: string | null,"id"?: string,"started_at"?: string,"target_email"?: string,"target_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "impersonation_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "impersonation_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "impersonation_log_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "impersonation_log_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"official_unavailability": {
                  Row: {
                    "created_at": string,"end_date": string,"end_time": string | null,"id": string,"note": string | null,"start_date": string,"start_time": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"end_time"?: string | null,"id"?: string,"note"?: string | null,"start_date": string,"start_time"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"end_time"?: string | null,"id"?: string,"note"?: string | null,"start_date"?: string,"start_time"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "official_unavailability_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "official_unavailability_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "can_nominate": boolean,"city": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"is_referee": boolean,"is_table_official": boolean,"phone": string | null,"region": Database["public"]['Enums']["region"] | null,"role": Database["public"]['Enums']["user_role"],"table_skills": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "can_nominate"?: boolean,"city"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_referee"?: boolean,"is_table_official"?: boolean,"phone"?: string | null,"region"?: Database["public"]['Enums']["region"] | null,"role"?: Database["public"]['Enums']["user_role"],"table_skills"?: (string)[]
                  }
                  Update: {
                    "can_nominate"?: boolean,"city"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_referee"?: boolean,"is_table_official"?: boolean,"phone"?: string | null,"region"?: Database["public"]['Enums']["region"] | null,"role"?: Database["public"]['Enums']["user_role"],"table_skills"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"proposal_responses": {
                  Row: {
                    "proposal_id": string,"reason": string | null,"responded_at": string,"responded_by": string | null,"response": Database["public"]['Enums']["response_kind"],"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "proposal_id": string,"reason"?: string | null,"responded_at"?: string,"responded_by"?: string | null,"response": Database["public"]['Enums']["response_kind"],"team_id": string
                  }
                  Update: {
                    "proposal_id"?: string,"reason"?: string | null,"responded_at"?: string,"responded_by"?: string | null,"response"?: Database["public"]['Enums']["response_kind"],"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposal_responses_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "hosting_proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_responses_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_responses_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_responses_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "proposal_responses_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_coaches": {
                  Row: {
                    "team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "team_id": string,"user_id": string
                  }
                  Update: {
                    "team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_coaches_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_coaches_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_coaches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_coaches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "category_id": string,"club_id": string,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"club_id": string,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "category_id"?: string,"club_id"?: string,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["category_id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "public_clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["club_id"]
    }
                  ]
                },"tournaments": {
                  Row: {
                    "category_id": string,"id": string,"name": string,"number": number,"period": string | null,"season": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"id"?: string,"name": string,"number": number,"period"?: string | null,"season"?: string
                  }
                  Update: {
                    "category_id"?: string,"id"?: string,"name"?: string,"number"?: number,"period"?: string | null,"season"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournaments_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournaments_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["category_id"]
    }
                  ]
                }
          }
          Views: {
            "group_overview": {
                  Row: {
                    "category_code": string,"category_id": string,"category_name": string,"category_sort": number,"confirmed_proposal_id": string | null,"games_count": number | null,"games_done": number | null,"group_id": string,"group_name": string,"pending_count": number | null,"region": Database["public"]['Enums']["region"] | null,"sort_order": number,"status": string | null,"tournament_id": string,"tournament_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "groups_confirmed_proposal_fk"
      columns: ["confirmed_proposal_id"]
isOneToOne: false
      referencedRelation: "hosting_proposals"
      referencedColumns: ["id"]
    }
                  ]
                },"group_standings": {
                  Row: {
                    "group_id": string,"lost": number | null,"played": number | null,"points": number | null,"points_against": number | null,"points_for": number | null,"team_id": string,"won": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "public_groups"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "group_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "group_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_names": {
                  Row: {
                    "city": string | null,"full_name": string,"id": string,"is_referee": boolean,"is_table_official": boolean,"region": Database["public"]['Enums']["region"] | null,"table_skills": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                           "city"?: string | null,"full_name"?: string | null,"id"?: string | null,"is_referee"?: boolean | null,"is_table_official"?: boolean | null,"region"?: Database["public"]['Enums']["region"] | null,"table_skills"?: (string)[] | null
                         }
                        Update: {
                           "city"?: string | null,"full_name"?: string | null,"id"?: string | null,"is_referee"?: boolean | null,"is_table_official"?: boolean | null,"region"?: Database["public"]['Enums']["region"] | null,"table_skills"?: (string)[] | null
                         }
                        Relationships: [
                    
                  ]
                },"public_clubs": {
                  Row: {
                    "city": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                           "city"?: string | null,"id"?: string | null,"name"?: string | null
                         }
                        Update: {
                           "city"?: string | null,"id"?: string | null,"name"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"public_games": {
                  Row: {
                    "away_club_id": string | null,"away_name": string | null,"category_code": string,"category_name": string,"category_scope": Database["public"]['Enums']["category_scope"],"category_sort": number,"competition": Database["public"]['Enums']["game_competition"],"group_id": string | null,"group_name": string | null,"gym_address": string | null,"gym_city": string | null,"gym_maps_url": string | null,"gym_name": string | null,"home_club_id": string | null,"home_name": string | null,"id": string,"is_done": boolean | null,"label": string | null,"starts_at": string,"tournament_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "public_groups"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["away_club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["home_club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["away_club_id"]
isOneToOne: false
      referencedRelation: "public_clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["home_club_id"]
isOneToOne: false
      referencedRelation: "public_clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["away_club_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["club_id"]
    },{
      foreignKeyName: "teams_club_id_fkey"
      columns: ["home_club_id"]
isOneToOne: false
      referencedRelation: "public_group_teams"
      referencedColumns: ["club_id"]
    }
                  ]
                },"public_group_teams": {
                  Row: {
                    "club_city": string | null,"club_id": string,"club_name": string,"group_id": string,"team_id": string,"team_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_overview"
      referencedColumns: ["group_id"]
    },{
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_teams_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "public_groups"
      referencedColumns: ["group_id"]
    }
                  ]
                },"public_groups": {
                  Row: {
                    "category_code": string,"category_name": string,"category_sort": number,"end_date": string | null,"group_id": string,"group_name": string,"gym_address": string | null,"gym_city": string | null,"gym_maps_url": string | null,"gym_name": string | null,"host_name": string | null,"notes": string | null,"region": Database["public"]['Enums']["region"] | null,"sort_order": number,"start_date": string | null,"tournament_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "_auto_confirm_if_active":
{ Args: { "p_proposal_id": string }; Returns: undefined
                           },
"_try_auto_confirm":
{ Args: { "p_proposal_id": string }; Returns: undefined
                           },
"admin_assign_organizer":
{ Args: { "p_end_date"?: string,"p_group_id": string,"p_gym_id": string,"p_notes"?: string,"p_start_date": string,"p_team_id": string }; Returns: string
                           },
"admin_confirm_proposal":
{ Args: { "p_proposal_id": string }; Returns: undefined
                           },
"admin_unconfirm_group":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"admin_update_tournament":
{ Args: { "p_end_date"?: string,"p_group_id": string,"p_gym_id": string,"p_move_games"?: boolean,"p_notes"?: string,"p_start_date": string }; Returns: undefined
                           },
"app_conditions_text":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"auto_confirm_active":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_act_for_team":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"can_admin_region":
{ Args: { "p_region": Database["public"]['Enums']["region"] }; Returns: boolean
                           },
"can_manage_game_row":
{ Args: { "p_away": string,"p_competition": Database["public"]['Enums']["game_competition"],"p_group_id": string,"p_home": string,"p_region": Database["public"]['Enums']["region"] }; Returns: boolean
                           },
"can_manage_group_games":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"can_nominate_any":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_nominate_region":
{ Args: { "p_region": Database["public"]['Enums']["region"] }; Returns: boolean
                           },
"can_view_game":
{ Args: { "p_game_id": string }; Returns: boolean
                           },
"can_view_game_row":
{ Args: { "p_away": string,"p_competition": Database["public"]['Enums']["game_competition"],"p_group_id": string,"p_home": string,"p_region": Database["public"]['Enums']["region"] }; Returns: boolean
                           },
"can_view_group":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"can_view_profile":
{ Args: { "p_target": string }; Returns: boolean
                           },
"can_view_regional_category":
{ Args: { "p_category_id": string }; Returns: boolean
                           },
"create_proposal":
{ Args: { "p_conditions_accepted"?: boolean,"p_end_date"?: string,"p_group_id": string,"p_gym_id": string,"p_notes"?: string,"p_start_date": string,"p_team_id": string }; Returns: string
                           },
"game_region":
{ Args: { "p_game_id": string }; Returns: Database["public"]['Enums']["region"]
                           },
"game_region_of":
{ Args: { "p_competition": Database["public"]['Enums']["game_competition"],"p_group_id": string,"p_region": Database["public"]['Enums']["region"] }; Returns: Database["public"]['Enums']["region"]
                           },
"group_host_team":
{ Args: { "p_group_id": string }; Returns: string
                           },
"group_region":
{ Args: { "p_group_id": string }; Returns: Database["public"]['Enums']["region"]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_club_manager":
{ Args: { "p_club_id": string }; Returns: boolean
                           },
"is_master_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_my_team":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"is_national_category":
{ Args: { "p_category_id": string }; Returns: boolean
                           },
"is_official":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_region":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["region"]
                           },
"my_team_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"profile_region":
{ Args: { "p_user_id": string }; Returns: Database["public"]['Enums']["region"]
                           },
"respond_to_nomination":
{ Args: { "p_nomination_id": string,"p_reason"?: string,"p_response": Database["public"]['Enums']["nomination_status"] }; Returns: undefined
                           },
"respond_to_proposal":
{ Args: { "p_proposal_id": string,"p_reason"?: string,"p_response": Database["public"]['Enums']["response_kind"],"p_team_id": string }; Returns: undefined
                           },
"set_game_scoresheet":
{ Args: { "p_game_id": string,"p_scoresheet"?: string }; Returns: undefined
                           },
"update_proposal":
{ Args: { "p_end_date"?: string,"p_gym_id": string,"p_notes"?: string,"p_proposal_id": string,"p_start_date": string }; Returns: undefined
                           },
"withdraw_proposal":
{ Args: { "p_proposal_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "category_scope": "regional"|"national","game_competition": "regional"|"national"|"friendly","game_status": "scheduled"|"played"|"forfeit_home"|"forfeit_away","nomination_status": "pending"|"accepted"|"rejected","official_position": "referee_1"|"referee_2"|"referee_3"|"scorer"|"assistant_scorer"|"timekeeper"|"shot_clock"|"statistician_1"|"statistician_2"|"statistician_3","proposal_status": "pending"|"confirmed"|"withdrawn"|"not_selected","region": "SR5"|"SR6","response_kind": "accept"|"reject","user_role": "master_admin"|"user"|"regional_admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "category_scope": ["regional", "national"],"game_competition": ["regional", "national", "friendly"],"game_status": ["scheduled", "played", "forfeit_home", "forfeit_away"],"nomination_status": ["pending", "accepted", "rejected"],"official_position": ["referee_1", "referee_2", "referee_3", "scorer", "assistant_scorer", "timekeeper", "shot_clock", "statistician_1", "statistician_2", "statistician_3"],"proposal_status": ["pending", "confirmed", "withdrawn", "not_selected"],"region": ["SR5", "SR6"],"response_kind": ["accept", "reject"],"user_role": ["master_admin", "user", "regional_admin"]
          }
        }
} as const
